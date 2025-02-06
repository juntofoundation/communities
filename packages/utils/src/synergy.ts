import {
  LinkQuery,
  PerspectiveExpression,
  NeighbourhoodProxy,
  PerspectiveProxy,
  Literal,
  Expression,
} from "@coasys/ad4m";
import { getAd4mClient } from "@coasys/ad4m-connect/utils";
import { Conversation, ConversationSubgroup, Topic } from "@coasys/flux-api";
import { v4 as uuidv4 } from "uuid";
import { sleep } from "./sleep";

export async function getAllTopics(perspective) {
  // gather up all existing topics in the neighbourhood
  return (await Topic.query(perspective)).map((topic: any) => {
    return { baseExpression: topic.baseExpression, name: topic.topic };
  });
}

class SynergyItem {
  type: string;
  baseExpression: string;
  author: string;
  timestamp: string;
  text: string;
  icon: string;
}
export async function getSynergyItems(perspective, parentId): Promise<SynergyItem[]> {
  // Get all child items of parentId, with timestamp and author
  // if we can get a Text either as
  // - "body" property through Message class
  // - "title" property through Post class, or
  // - "name" propoerty through Task class
  const items: {
    Item: string;
    Timestamp: number; //unix milliseconds
    Author: string;
    Text: string;
    Type: string; //"Message", "Post", "Task"
  }[] = await perspective.infer(`
    triple("${parentId}", "ad4m://has_child", Item),
    findall(
      [Timestamp, Author], 
      link(_, "ad4m://has_child", Item, Timestamp, Author),
      AllData
      ), 
    sort(AllData, SortedData),
    SortedData = [[Timestamp, Author]|_],
    (
      Type = "Message",
      subject_class("Message", MessageClass),
      instance(MessageClass, Item), 
      property_getter(MessageClass, Item, "body", Text)
      ;
      Type = "Post",
      subject_class("Post", PostClass),
      instance(PostClass, Item), 
      property_getter(PostClass, Item, "title", Text)
      ;
      Type = "Task",
      subject_class("Task", TaskClass),
      instance(TaskClass, Item), 
      property_getter(TaskClass, Item, "name", Text)
    ).
    `);

  if (!items) return [];

  const icons = {
    Message: "chat",
    Post: "postcard",
    Task: "kanban",
  };

  return items
    .map((item) => {
      let textExpression = Literal.fromUrl(item.Text).get() as Expression;
      return {
        type: item.Type,
        baseExpression: item.Item,
        author: item.Author,
        timestamp: new Date(item.Timestamp).toISOString(),
        text: textExpression.data,
        icon: icons[item.Type] ? icons[item.Type] : "question",
      };
    })
    .filter((item, index, self) => self.findIndex((i) => i.baseExpression === item.baseExpression) === index)
    .sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
}

export async function getDefaultLLM() {
  const client = await getAd4mClient();
  return await client.ai.getDefaultModel("LLM");
}

// todo: replace with new query in TimelineColumn
export async function findUnprocessedItems(perspective: any, items: any[], allSubgroupIds: string[]) {
  const results = await Promise.all(
    items.map(async (item) => {
      const links = await perspective.get(
        new LinkQuery({ predicate: "ad4m://has_child", target: item.baseExpression })
      );
      // if the item has a parent link to a subgroup we know it has been processed
      const isProcessed = links.some((link) => allSubgroupIds.includes(link.data.source));
      return isProcessed ? null : item;
    })
  );
  return results.filter(Boolean);
}

async function isMe(did: string) {
  // checks if the did is mine
  const client = await getAd4mClient();
  const me = await client.agent.me();
  return did === me.did;
}

let receivedSignals: any[] = [];
let signalHandler: ((expression: PerspectiveExpression) => void) | null = null;

async function onSignalReceived(
  expression: PerspectiveExpression,
  neighbourhood: NeighbourhoodProxy,
  setProcessingData: any
) {
  const link = expression.data.links[0];
  const { author, data } = link;
  const { source, predicate, target } = data;

  if (predicate === "can-you-process-items") {
    const defaultLLM = await getDefaultLLM();
    console.log(`Signal recieved: can you process items? (${defaultLLM ? "yes" : "no"})`);
    if (defaultLLM)
      await neighbourhood.sendSignalU(author, {
        links: [{ source: "", predicate: "i-can-process-items", target }],
      });
  }

  if (predicate === "i-can-process-items") {
    console.log(`Signal recieved: remote agent ${author} can process items!`);
    receivedSignals.push(link);
  }

  if (predicate === "processing-items-started") {
    const items = JSON.parse(target);
    console.log(`Signal recieved: ${items.length} items being processed by ${author}`);
    processing = true;
    setProcessingData({ author, channel: source, items });
  }

  if (predicate === "processing-items-finished") {
    console.log(`Signal recieved: ${author} finished processing items`);
    processing = false;
    setProcessingData(null);
  }
}

export async function addSynergySignalHandler(perspective: PerspectiveProxy, setProcessingData: any) {
  const neighbourhood = await perspective.getNeighbourhoodProxy();
  signalHandler = (expression: PerspectiveExpression) => onSignalReceived(expression, neighbourhood, setProcessingData);
  neighbourhood.addSignalHandler(signalHandler);
}

export async function removeSynergySignalHandler(perspective: PerspectiveProxy) {
  if (signalHandler) {
    const neighbourhood = await perspective.getNeighbourhoodProxy();
    neighbourhood.removeSignalHandler(signalHandler);
    signalHandler = null;
  }
}

async function agentCanProcessItems(neighbourhood: NeighbourhoodProxy, agentsDid: string): Promise<boolean> {
  const signalUuid = uuidv4();
  await neighbourhood.sendSignalU(agentsDid, {
    links: [{ source: "", predicate: "can-you-process-items", target: signalUuid }],
  });

  await sleep(3000);
  return receivedSignals.some((s) => s.data.target === signalUuid);
}
// todo: store these consts in channel settings
const minItemsToProcess = 5;
const maxItemsToProcess = 10;
const numberOfItemsDelay = 3;

async function responsibleForProcessing(
  perspective: PerspectiveProxy,
  neighbourhood: NeighbourhoodProxy,
  channelId: string,
  unprocessedItems: any[],
  increment = 0
): Promise<boolean> {
  // check if enough unprocessed items are present to run the processing task (increment used so we can keep checking the next item until the limit is reached)
  const enoughUnprocessedItems = unprocessedItems.length >= minItemsToProcess + numberOfItemsDelay + increment;
  if (!enoughUnprocessedItems) {
    console.log("not enough items to process");
    return false;
  } else {
    // find the author of the nth item
    const nthItem = unprocessedItems[minItemsToProcess + increment - 1];
    // if we are the author, we are responsible for processing
    if (await isMe(nthItem.author)) {
      console.log("we are the author of the nth item!");
      return true;
    } else {
      // if not, signal the author to check if they can process the items
      const authorCanProcessItems = await agentCanProcessItems(neighbourhood, nthItem.author);
      console.log("author can process items:", authorCanProcessItems);
      // if they can, we aren't responsible for processing
      if (authorCanProcessItems) return false;
      else {
        // if they can't, re-run the check on the next item
        console.log("re-run responsibleForProcessing with increment:", increment + 1);
        return await responsibleForProcessing(perspective, neighbourhood, channelId, unprocessedItems, increment + 1);
      }
    }
  }
}

export async function getConversationIds(perspective: PerspectiveProxy, channelId: string) {
  // todo: sort by timestamp?
  const result = await perspective.infer(`
    findall(ConversationId, (
      % 1. Find all conversations in the channel
      subject_class("Conversation", ConversationClass),
      instance(ConversationClass, ConversationId),
      triple("${channelId}", "ad4m://has_child", SubgroupId)
    ), ConversationIds).
  `);

  return result[0]?.ConversationIds || [];
}

export async function getSubgroupIds(perspective: PerspectiveProxy, conversationId: string) {
  // todo: sort by timestamp?
  const result = await perspective.infer(`
    findall(SubgroupId, (
      % 1. Find all conversations in the channel
      subject_class("ConversationSubgroup", SubgroupClass),
      instance(SubgroupClass, SubgroupId),
      triple("${conversationId}", "ad4m://has_child", SubgroupId)
    ), SubgroupIds).
  `);

  return result[0]?.SubgroupIds || [];
}

export async function getLastSubgroupItemsTimestamp(perspective: PerspectiveProxy, subgroupId: string) {
  const result = await perspective.infer(`
    findall(LastTimestamp, (
      % 1. Get all valid items and their timestamps
      findall(Timestamp, (
        triple("${subgroupId}", "ad4m://has_child", Item),
        
        % 2. Check item is valid type
        (
          subject_class("Message", MC),
          instance(MC, Item)
          ;
          subject_class("Post", PC),
          instance(PC, Item)
          ;
          subject_class("Task", TC),
          instance(TC, Item)
        ),
        
        % 3. Get timestamp
        link(_, "ad4m://has_child", Item, Timestamp, _)
      ), Timestamps),
      
      % 4. Sort timestamps and get last one
      sort(Timestamps, SortedTimestamps),
      reverse(SortedTimestamps, [LastTimestamp|_])
    ), [FinalTimestamp]).
  `);

  return result[0]?.FinalTimestamp || null;
}

export async function getLastSubgroupsTimestamp(perspective: PerspectiveProxy, subgroupId: string) {
  const result = await perspective.infer(`
    findall(Timestamp, (
      % 1. Get subgroup timestamp directly from link
      link(_, "ad4m://has_child", "${subgroupId}", Timestamp, _)
    ), [SubgroupTimestamp]).
  `);

  return result[0]?.SubgroupTimestamp || null;
}

function minsSinceCreated(createdAt: number) {
  const millisecondsSinceCreated = new Date().getTime() - new Date(createdAt).getTime();
  return millisecondsSinceCreated / (1000 * 60);
}

async function findOrCreateNewConversation(perspective: PerspectiveProxy, channelId: string): Promise<Conversation> {
  // fetch existing conversation ids from the channel
  const conversationIds = await getConversationIds(perspective, channelId);
  if (conversationIds.length) {
    // get the last conversations subgroup ids
    const lastConversationId = conversationIds[conversationIds.length - 1];
    const subgroupIds = await getSubgroupIds(perspective, lastConversationId);
    // error case: if conversation found but no subgroups added yet, reuse the conversation
    if (!subgroupIds.length) return new Conversation(perspective, lastConversationId).get();
    // get the timestamp of the last item in the last subgroup
    const lastSubgroupId = subgroupIds[subgroupIds.length - 1];
    let timestamp = await getLastSubgroupItemsTimestamp(perspective, lastSubgroupId);
    // error case: if subgroup found but no items added yet, use the timestamp of the subgroup
    if (!timestamp) timestamp = await getLastSubgroupsTimestamp(perspective, lastSubgroupId);
    // if recent activity found, reuse conversation
    if (timestamp && minsSinceCreated(timestamp) < 30) return new Conversation(perspective, lastConversationId).get();
  }
  // if no conversations found, create a new conversation
  const conversation = new Conversation(perspective, undefined, channelId);
  conversation.conversationName = "Generating conversation...";
  conversation.summary = "Content will appear when processing is complete";
  await conversation.save();
  return conversation.get();
}

export async function findAllChannelSubgroupIds(
  perspective: PerspectiveProxy,
  conversations: Conversation[]
): Promise<string[]> {
  const subgroups = await Promise.all(
    conversations.map((conversation) =>
      ConversationSubgroup.query(perspective, { source: conversation.baseExpression })
    )
  );
  return [...new Set(subgroups.flat().map((subgroup) => subgroup.baseExpression))];
}

let processing = false;
export async function runProcessingCheck(
  perspective: PerspectiveProxy,
  channelId: string,
  unprocessedItems: any[],
  setProcessingData: any
) {
  console.log("runProcessingCheck");
  // only attempt processing if default LLM is set
  if (!(await getDefaultLLM())) return;

  // check if we are responsible for processing
  const neighbourhood = await perspective.getNeighbourhoodProxy();
  const responsible: boolean = await responsibleForProcessing(perspective, neighbourhood, channelId, unprocessedItems);
  console.log("responsible for processing", responsible);
  // if we are responsible, process items & add to conversation
  if (responsible && !processing) {
    const client = await getAd4mClient();
    const me = await client.agent.me();
    const numberOfItemsToProcess = Math.min(maxItemsToProcess, unprocessedItems.length - numberOfItemsDelay);
    const itemsToProcess = unprocessedItems.slice(0, numberOfItemsToProcess);
    const itemIds = itemsToProcess.map((item) => item.baseExpression);
    processing = true;
    setProcessingData({ author: me.did, channel: channelId, items: itemIds });
    // notify other agents that we are processing
    await neighbourhood.sendBroadcastU({
      links: [{ source: channelId, predicate: "processing-items-started", target: JSON.stringify(itemIds) }],
    });

    const conversation = await findOrCreateNewConversation(perspective, channelId);
    try {
      await conversation.processNewExpressions(itemsToProcess);
    } catch (e) {
      console.log("Error processing items into conversation:" + e);
    }

    // update processing items state
    processing = false;
    setProcessingData(null);
    // notify other agents
    await neighbourhood.sendBroadcastU({
      links: [{ source: channelId, predicate: "processing-items-finished", target: "" }],
    });
  }
}

export async function startTranscription(callback: (text) => void) {
  const client = await getAd4mClient();
  return await client.ai.openTranscriptionStream("Whisper", callback);
}

export async function feedTranscription(id, chunks) {
  const client = await getAd4mClient();
  await client.ai.feedTranscriptionStream(id, Array.from(chunks));
}

export async function stopTranscription(id) {
  const client = await getAd4mClient();
  await client.ai.closeTranscriptionStream(id);
}
