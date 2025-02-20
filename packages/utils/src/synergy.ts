import { PerspectiveExpression, NeighbourhoodProxy, PerspectiveProxy, Literal } from "@coasys/ad4m";
// @ts-ignore
import { getAd4mClient } from "@coasys/ad4m-connect/utils";
import { Conversation, Topic } from "@coasys/flux-api";
import { v4 as uuidv4 } from "uuid";
import { sleep } from "./sleep";
import { isEqual } from "lodash";

export const icons = { Message: "chat", Post: "postcard", Task: "kanban" };
export const groupingOptions = ["Conversations", "Subgroups", "Items"];
export const itemTypeOptions = ["All Types", "Messages", "Posts", "Tasks"];
export const minItemsToProcess = 5;
export const maxItemsToProcess = 10;
export const numberOfItemsDelay = 3;

export type GroupingOption = (typeof groupingOptions)[number];
export type ItemTypeOption = (typeof itemTypeOptions)[number];
export type ItemType = "Message" | "Post" | "Task";
export type SearchType = "" | "vector" | "topic";
export type BlockType = "conversation" | "subgroup" | "item";
export type FilterSettings = { grouping: GroupingOption; itemType: "All Types" | ItemType; includeChannel: boolean };
export type MatchIndexes = { conversation: number | undefined; subgroup: number | undefined; item: number | undefined };
export type ProcessingData = { author: string; channelId: string; items: string[] };
export type Link = { source: string; predicate: string; target: string };
export type LinkExpression = { author: string; data: Link };

const receivedSignals: LinkExpression[] = [];
let signalHandler: ((expression: PerspectiveExpression) => void) | null = null;
let processing = false;

export class SynergyGroup {
  // used for conversations & subgroups
  baseExpression: string;
  name: string;
  summary: string;
  timestamp: string;
  index?: number;
}

export class SynergyItem {
  // used for items: messages, posts, & tasks
  baseExpression: string;
  author: string;
  type: ItemType;
  icon: string;
  timestamp: string;
  text: string;
  index?: number;
  blockType?: string;
}

export class SynergyMatch {
  baseExpression: string;
  channelId: string;
  channelName: string;
  type: string;
  score?: number;
  relevance?: number;
  embedding?: number[];
}

export class SynergyTopic {
  baseExpression: string;
  name: string;
}

export function detectBrowser(): string {
  if (typeof (window as any).InstallTrigger !== "undefined") return "firefox";
  if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) return "safari";
  if (navigator.userAgent.includes("Edg")) return "edge";
  if ((navigator as any)?.brave?.isBrave) return "brave";
  // check chrome last as edge & brave are chromium based so would pass as chrome with the following logic
  if ((window as any).chrome && navigator.vendor === "Google Inc.") return "chrome";
  return "unknown";
}

export async function getAllTopics(perspective: PerspectiveProxy) {
  // gather up all existing topics in the neighbourhood
  return (await Topic.query(perspective)).map((topic: any) => {
    return { baseExpression: topic.baseExpression, name: Literal.fromUrl(topic.topic).get() };
  });
}

export async function getDefaultLLM() {
  const client = await getAd4mClient();
  return await client.ai.getDefaultModel("LLM");
}

export async function isMe(did: string): Promise<boolean> {
  // checks if the did is mine
  const client = await getAd4mClient();
  const me = await client.agent.me();
  return did === me.did;
}

export async function addSynergySignalHandler(
  perspective: PerspectiveProxy,
  setProcessingData: React.Dispatch<React.SetStateAction<ProcessingData | null>>,
  waitingForResponse: React.MutableRefObject<boolean>
): Promise<void> {
  const neighbourhood = await perspective.getNeighbourhoodProxy();
  signalHandler = (expression: PerspectiveExpression) =>
    onSignalReceived(expression, neighbourhood, setProcessingData, waitingForResponse);
  neighbourhood.addSignalHandler(signalHandler);
}

export async function removeSynergySignalHandler(perspective: PerspectiveProxy): Promise<void> {
  if (signalHandler) {
    const neighbourhood = await perspective.getNeighbourhoodProxy();
    neighbourhood.removeSignalHandler(signalHandler);
    signalHandler = null;
  }
}

// todo: apply channel check so processing can occur in multiple channels simultaneouly
async function onSignalReceived(
  expression: PerspectiveExpression,
  neighbourhood: NeighbourhoodProxy,
  setProcessingData: React.Dispatch<React.SetStateAction<ProcessingData | null>>,
  waitingForResponse: React.MutableRefObject<boolean>
): Promise<void> {
  const link = expression.data.links[0];
  const { author, data } = link;
  const { source, predicate, target } = data;
  const client = await getAd4mClient();
  const me = await client.agent.me();

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
    setProcessingData({ author, channelId: source, items });
  }

  if (predicate === "processing-items-finished") {
    console.log(`Signal recieved: ${author} finished processing items`);
    processing = false;
    setProcessingData(null);
  }

  if (predicate === "is-anyone-processing") {
    console.log(`Signal recieved: ${author} wants to know if anyone is processing`);
    setProcessingData((prev) => {
      if (prev && prev.author === me.did) {
        neighbourhood.sendSignalU(author, {
          links: [{ source: "", predicate: "processing-in-progress", target: JSON.stringify(prev) }],
        });
      }
      return prev;
    });
  }

  if (predicate === "processing-in-progress") {
    console.log(`Signal recieved: ${author} confirmed that they are currently processing`);
    setProcessingData((prev) => {
      // mark processing true, waiting false, & update state if changed
      processing = true;
      waitingForResponse.current = false;
      return isEqual(JSON.parse(target), prev) ? prev : JSON.parse(target);
    });
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

async function responsibleForProcessing(
  perspective: PerspectiveProxy,
  neighbourhood: NeighbourhoodProxy,
  channelId: string,
  unprocessedItems: any[],
  increment = 0
): Promise<boolean> {
  // check if enough unprocessed items are present to run the processing task (increment used so we can keep checking the next item until the limit is reached)
  const enoughUnprocessedItems = unprocessedItems.length >= minItemsToProcess + numberOfItemsDelay + increment;
  if (!enoughUnprocessedItems) return false;
  else {
    // find the author of the nth item
    const nthItem = unprocessedItems[minItemsToProcess + increment - 1];
    // if we are the author, we are responsible for processing
    if (await isMe(nthItem.author)) return true;
    else {
      // if not, signal the author to check if they can process the items
      const authorCanProcessItems = await agentCanProcessItems(neighbourhood, nthItem.author);
      // if they can, we aren't responsible for processing
      if (authorCanProcessItems) return false;
      else {
        // if they can't, re-run the check on the next item
        return await responsibleForProcessing(perspective, neighbourhood, channelId, unprocessedItems, increment + 1);
      }
    }
  }
}

// todo: sort by timestamp?
export async function getConversationIds(perspective: PerspectiveProxy, channelId: string): Promise<string[]> {
  const result = await perspective.infer(`
    findall(ConversationId, (
      % 1. Find all conversations in the channel
      subject_class("Conversation", ConversationClass),
      instance(ConversationClass, ConversationId),
      triple("${channelId}", "ad4m://has_child", ConversationId)
    ), ConversationIds).
  `);

  return result[0]?.ConversationIds || [];
}

// todo: sort by timestamp?
export async function getSubgroupIds(perspective: PerspectiveProxy, conversationId: string): Promise<string[]> {
  const result = await perspective.infer(`
    findall(SubgroupId, (
      % 1. Find all subgroups in the conversation
      subject_class("ConversationSubgroup", SubgroupClass),
      instance(SubgroupClass, SubgroupId),
      triple("${conversationId}", "ad4m://has_child", SubgroupId)
    ), SubgroupIds).
  `);

  return result[0]?.SubgroupIds || [];
}

export async function getLastSubgroupItemsTimestamp(
  perspective: PerspectiveProxy,
  subgroupId: string
): Promise<number | null> {
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

export async function getLastSubgroupsTimestamp(
  perspective: PerspectiveProxy,
  subgroupId: string
): Promise<number | null> {
  const result = await perspective.infer(`
    findall(Timestamp, (
      % 1. Get subgroup timestamp directly from link
      link(_, "ad4m://has_child", "${subgroupId}", Timestamp, _)
    ), [SubgroupTimestamp]).
  `);

  return result[0]?.SubgroupTimestamp || null;
}

function minsSinceCreated(createdAt: number): number {
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
    if (!subgroupIds.length) return await new Conversation(perspective, lastConversationId).get();
    // get the timestamp of the last item in the last subgroup
    const lastSubgroupId = subgroupIds[subgroupIds.length - 1];
    let timestamp = await getLastSubgroupItemsTimestamp(perspective, lastSubgroupId);
    // error case: if subgroup found but no items added yet, use the timestamp of the subgroup
    if (!timestamp) timestamp = await getLastSubgroupsTimestamp(perspective, lastSubgroupId);
    // if recent activity found, reuse conversation
    if (timestamp && minsSinceCreated(timestamp) < 30)
      return await new Conversation(perspective, lastConversationId).get();
  }
  // if no conversations found, create a new conversation
  const conversation = new Conversation(perspective, undefined, channelId);
  conversation.conversationName = "Generating conversation...";
  conversation.summary = "Content will appear when processing is complete";
  await conversation.save();
  return await conversation.get();
}

export async function runProcessingCheck(
  perspective: PerspectiveProxy,
  channelId: string,
  unprocessedItems: any[],
  setProcessingData: (data: ProcessingData | null) => void
): Promise<void> {
  // only attempt processing if default LLM is set
  if (!(await getDefaultLLM())) return;

  // check if we are responsible for processing
  const neighbourhood = await perspective.getNeighbourhoodProxy();
  const responsible = await responsibleForProcessing(perspective, neighbourhood, channelId, unprocessedItems);

  // if we are responsible, process items & add to conversation
  if (responsible && !processing) {
    const client = await getAd4mClient();
    const me = await client.agent.me();
    const numberOfItemsToProcess = Math.min(maxItemsToProcess, unprocessedItems.length - numberOfItemsDelay);
    const itemsToProcess = unprocessedItems.slice(0, numberOfItemsToProcess);
    const itemIds = itemsToProcess.map((item) => item.baseExpression);
    processing = true;
    setProcessingData({ author: me.did, channelId, items: itemIds });
    // notify other agents that we are processing
    await neighbourhood.sendBroadcastU({
      links: [{ source: channelId, predicate: "processing-items-started", target: JSON.stringify(itemIds) }],
    });

    // process items into conversation
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

export async function checkIfProcessingInProgress(perspective: PerspectiveProxy, channelId: string): Promise<void> {
  // broadcast signal to check if processing in progress when entering the synergy view
  const neighbourhood = await perspective.getNeighbourhoodProxy();
  await neighbourhood.sendBroadcastU({
    links: [{ source: channelId, predicate: "is-anyone-processing", target: "" }],
  });
}
