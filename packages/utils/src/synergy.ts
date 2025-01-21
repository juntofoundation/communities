import {
  Ad4mClient,
  AITask,
  LinkQuery,
  PerspectiveExpression,
  NeighbourhoodProxy,
  PerspectiveProxy,
} from "@coasys/ad4m";
import { getAd4mClient } from "@coasys/ad4m-connect/utils";
import {
  Conversation,
  ConversationSubgroup,
  Embedding,
  Message,
  Post,
  SemanticRelationship,
  SubjectRepository,
  Topic,
} from "@coasys/flux-api";
//@ts-ignore
import JSON5 from "json5";
import { v4 as uuidv4 } from "uuid";

async function removeEmbedding(perspective, itemId) {
  const allSemanticRelationships = (await SemanticRelationship.query(perspective, {
    source: itemId,
  })) as any;
  const embeddingSR = allSemanticRelationships.find((sr) => !sr.relevance);
  if (embeddingSR) {
    const embedding = new Embedding(perspective, embeddingSR.tag);
    await embedding.delete(); // delete the embedding
    await embeddingSR.delete(); // delete the semantic relationship
  }
}

// todo: use embedding language instead of stringifying
async function createEmbedding(perspective, text, itemId) {
  // generate embedding
  const client = await getAd4mClient();
  const rawEmbedding = await client.ai.embed("bert", text);
  // create embedding subject entity
  const embedding = new Embedding(perspective, undefined, itemId);
  embedding.model = "bert";
  embedding.embedding = JSON.stringify(rawEmbedding);
  await embedding.save();
  // create semantic relationship subject entity
  const relationship = new SemanticRelationship(perspective, undefined, itemId);
  relationship.expression = itemId;
  relationship.tag = embedding.baseExpression;
  await relationship.save();
}

async function linkTopic(perspective, itemId, topicId, relevance) {
  const relationship = new SemanticRelationship(perspective, undefined, itemId);
  relationship.expression = itemId;
  relationship.tag = topicId;
  relationship.relevance = relevance;
  await relationship.save();
}

export async function ensureLLMTask(): Promise<AITask> {
  const taskPrompt = `
    You are here as an integrated part of a chat system - you're answers will be directly parsed by JSON.parse().
    So make sure to always (!) respond with valid JSON!!

    I'm passing you a JSON object with the following properties:
    1. 'existingTopics' (String array of all existing topic names)
    2. 'previousSubgroups' (Object array of all previous subgroup summaries and names)
    3. 'currentSubgroup' (Object with name, summary and topics of the currently active subgroup)
    3. 'unprocessedItems' (Object array of all unprocessed items. Each unprocessed item is a javascript object with an 'id' property (string) and a 'text' property (string))

    Main point of this is sorting the new messages into the flow of the conversation, either all in the current subgroup,
    or if necessary creating a new subgroup.

    I want you to respond with a JSON object with these properties:
    1. 'conversationData' (Object with 'name' and 'summary' properties. Updated summary of the whole conversation taking all subgroup titles and summaries (old and new) into account).
    2. 'currentSubgroup' (Undefined or Object with 'name', 'summary' and 'topics' of the current subgroup after including new items)
    3. 'newSubgroup' (Undefined or an object with 'name', 'summary', 'topics' and 'firstItemId' of the new subgroupd spawned by a shift of the conversation in the new itmes)

    Firstly, analyze the 'summary' of the 'currentSubgroup' and the 'text' property of each unprocessedItem to identify if the conversation has shifted to a new subject or not.
    Consider the conversation as **related** if:
    - The text in an unprocessed item discusses, contrasts, or expands upon themes present in the last unprocessed item.
    - The text in an unprocessed item introduces new angles, comparisons, or opinions on the same topics discussed in the last unprocessed item (even if specific terms or phrases differ).
    Only consider the conversation as having **shifted to a new subject** if:
    - The text in an unprocessed item introduces entirely new topics, concepts, or themes that are not directly related to any topics discussed or implied in the last unprocessed item.
    - The text in an unprocessed item does not logically connect or refer back to the themes in the last unprocessed item.
    - The following messages actually reflect the acceptence of that topic shift.

    If 'previousSubgroups' is emtpy, always create a 'newSubgroup' (the conversation has just begun).

    In case where the conversation has shifted, also generate a 'newSubgroup' including the following properties:
    1. 'name': a 1 to 3 word title (string) describing the contents of the subgroup.
    2. 'summary': a 1 to 3 sentence paragraph (string) summary of the contents of the subgroup.
    3. 'firstItemId': the 'id' of the first unprocessed item in the subgroup.
    4. 'topics': an array of between 1 and 5 topic objects indicating topics that are relevant to the contents of the subgroup (a bit like hashtags).
    Each topic object should including a 'name' property (a single word string in lowercase) for the name of the topic
    and a 'relevance' property (number) between 0 and 100 (0 being irrelevant and 100 being highly relevant) that indicates how relevant the topic is to the content of the text.
    If any of the topics you choose are similar to topics listed in the 'existingTopics' array, use the existing topic instead of creating 
    a new one (i.e. if one of the new topics you picked was 'foods' and you find an existing topic 'food', use 'food' instead of creating a new topic that is just a plural version of the existing topic).
    The output of this analysis will be a new 'subgroups' array conatining all of new subgroup objects you have generated.

    Finally, analyse all the summaries in the original 'previousSubgroups' array and the new summaries you've created, and use this info to generate a new 'conversationData' object with the following properties:
    1. 'name': a 1 to 3 word title (string) describing the contents of the conversation.
    2. 'summary': a 1 to 3 sentence paragraph (string) summary of the contents of the conversation.

    Make sure your response is in a format that can be parsed using JSON.parse(). Don't wrap it in code syntax. Don't append text outside of quotes. And don't use the assign operator ("=").
    If you make a mistake and I can't parse your output, I will give you the same input again, plus another field "jsonParseError" holding the error we got from JSON.parse().
    So if you see that field, take extra care about that specific mistake and don't make it again!
    Don't talk about the errors in the summaries or topics.
  `;

  const examples = [
    {
      input: `{
        "existingTopics": [],
        "previousSubgroups": [],
        "currentSubgroup": null,
        "unprocessedItems": [
          { "id": "1", "text": "The universe is constantly expanding, but scientists are still debating the exact rate." },
          { "id": "2", "text": "Dark energy is thought to play a significant role in driving the expansion of the universe." },
          { "id": "3", "text": "Recent measurements suggest there may be discrepancies in the Hubble constant values." },
          { "id": "4", "text": "These discrepancies might point to unknown physics beyond our current models." },
          { "id": "5", "text": "For instance, some theories suggest modifications to general relativity could explain this." }
        ]
      }`,
      output: `{
        "conversationData": {
          "name": "Cosmic Expansion",
          "summary": "The conversation explores the expansion of the universe, the role of dark energy, discrepancies in the Hubble constant, and potential modifications to general relativity."
        },
        "currentSubgroup": null,
        "newSubgroup": {
          "name": "Cosmic Expansion",
          "summary": "Discussion about the universe's expansion, including the role of dark energy, Hubble constant discrepancies, and possible new physics such as modifications to general relativity.",
          "firstItemId": "1",
          "topics": [
            { "name": "universe", "relevance": 100 },
            { "name": "expansion", "relevance": 100 },
            { "name": "darkenergy", "relevance": 90 },
            { "name": "hubble", "relevance": 80 },
            { "name": "relativity", "relevance": 70 }
          ]
        }
      }`,
    },
    {
      input: `{
        "existingTopics": ["universe", "expansion", "darkenergy", "hubble", "relativity"],
        "previousSubgroups": [
          {
            "name": "Cosmic Expansion",
            "summary": "Discussion about the universe's expansion, including the role of dark energy, Hubble constant discrepancies, and possible new physics such as modifications to general relativity."
          }
        ],
        "currentSubgroup": {
          "name": "Cosmic Expansion",
          "summary": "Discussion about the universe's expansion, including the role of dark energy, Hubble constant discrepancies, and possible new physics such as modifications to general relativity.",
          "topics": ["universe", "expansion", "darkenergy", "hubble", "relativity"]
        },
        "unprocessedItems": [
          { "id": "6", "text": "The cosmic microwave background also helps refine our estimates of the Hubble constant." },
          { "id": "7", "text": "Its measurements are among the most precise but still leave room for debate about the true value." },
          { "id": "8", "text": "By the way, a great way to bring out flavors in vegetables is to roast them with a mix of olive oil, garlic, and herbs." },
          { "id": "9", "text": "Caramelization from roasting adds depth to vegetables like carrots and Brussels sprouts." },
          { "id": "10", "text": "And don’t forget to season generously with salt and pepper before baking!" }
        ]
      }`,
      output: `{
        "conversationData": {
          "name": "Universe and Cooking",
          "summary": "The conversation explores the universe's expansion, including precise measurements of the Hubble constant, and transitions into tips for roasting vegetables to enhance their flavor."
        },
        "currentSubgroup": {
          "name": "Cosmic Expansion",
          "summary": "Discussion about the universe's expansion, including the role of dark energy, Hubble constant discrepancies, and precise measurements like those from the cosmic microwave background.",
          "topics": [
            { "name": "universe", "relevance": 100 },
            { "name": "expansion", "relevance": 100 },
            { "name": "darkenergy", "relevance": 90 },
            { "name": "hubble", "relevance": 80 },
            { "name": "relativity", "relevance": 70 }
          ]
        },
        "newSubgroup": {
          "name": "Vegetable Roasting",
          "summary": "Tips for enhancing vegetable flavors by roasting them with olive oil, garlic, herbs, and seasoning to achieve caramelization and depth.",
          "firstItemId": "8",
          "topics": [
            { "name": "cooking", "relevance": 100 },
            { "name": "vegetables", "relevance": 100 },
            { "name": "roasting", "relevance": 90 },
          ]
        }
      }`,
    },
    {
      input: `{
        "existingTopics": ["technology", "privacy", "data", "ethics"],
        "previousSubgroups": [
          {
            "name": "Tech and Privacy",
            "summary": "Discussion about how emerging technologies impact user privacy and the ethical implications of data collection."
          }
        ],
        "currentSubgroup": {
          "name": "Tech and Privacy",
          "summary": "Discussion about how emerging technologies impact user privacy and the ethical implications of data collection.",
          "topics": ["technology", "privacy", "data", "ethics"]
        },
        "unprocessedItems": [
          { "id": "6", "text": "Many companies are adopting privacy-first approaches to regain user trust." },
          { "id": "7", "text": "However, balancing innovation and privacy often creates challenges for developers." },
          { "id": "8", "text": "On another note, effective team collaboration relies heavily on clear communication and shared goals." },
          { "id": "9", "text": "Tools like Slack and Trello have made remote work more efficient by streamlining communication." },
          { "id": "10", "text": "Establishing regular check-ins and feedback loops further enhances team productivity." }
        ]
      }`,
      output: `{
        "conversationData": {
          "name": "Tech and Collaboration",
          "summary": "The conversation discusses privacy-first approaches and challenges in technology, then transitions into effective team collaboration and tools that enhance productivity."
        },
        "currentSubgroup": {
          "name": "Tech and Privacy",
          "summary": "Discussion about how emerging technologies impact user privacy and the ethical implications of data collection, including privacy-first approaches and challenges for developers.",
          "topics": [
            { "name": "technology", "relevance": 100 },
            { "name": "privacy", "relevance": 100 },
            { "name": "data", "relevance": 80 }
          ]
        },
        "newSubgroup": {
          "name": "Team Collaboration",
          "summary": "Exploration of effective team collaboration, focusing on tools like Slack and Trello, and practices like regular check-ins to enhance productivity.",
          "firstItemId": "8",
          "topics": [
            { "name": "collaboration", "relevance": 100 },
            { "name": "productivity", "relevance": 90 },
            { "name": "tools", "relevance": 80 }
          ]
        }
      }`,
    },
    {
      input: `{
        "existingTopics": ["fitness", "health", "nutrition"],
        "previousSubgroups": [
          {
            "name": "Fitness and Nutrition",
            "summary": "Discussion about the importance of balanced nutrition in supporting fitness and overall health."
          }
        ],
        "currentSubgroup": {
          "name": "Fitness and Nutrition",
          "summary": "Discussion about the importance of balanced nutrition in supporting fitness and overall health.",
          "topics": ["fitness", "health", "nutrition"]
        },
        "unprocessedItems": [
          { "id": "6", "text": "A well-rounded fitness routine includes both cardio and strength training." },
          { "id": "7", "text": "Proper hydration is also essential for maximizing workout performance." },
          { "id": "8", "text": "Speaking of hydration, the mineral content in water can affect recovery times." },
          { "id": "9", "text": "For example, electrolyte-rich water helps replenish what is lost through sweat." },
          { "id": "10", "text": "This shows how nutrition and hydration are deeply connected to fitness results." }
        ]
      }`,
      output: `{
        "conversationData": {
          "name": "Fitness and Nutrition",
          "summary": "The conversation emphasizes the importance of balanced nutrition and hydration in supporting fitness, with a focus on how mineral content in water and electrolyte replenishment enhance recovery and performance."
        },
        "currentSubgroup": {
          "name": "Fitness and Nutrition",
          "summary": "Discussion about the importance of balanced nutrition, hydration, and how the mineral content in water contributes to fitness recovery and performance.",
          "topics": [
            { "name": "fitness", "relevance": 100 },
            { "name": "health", "relevance": 90 },
            { "name": "nutrition", "relevance": 100 },
            { "name": "hydration", "relevance": 80 }
          ]
        },
        "newSubgroup": null
      }`,
    },
  ];

  const client: Ad4mClient = await getAd4mClient();
  const tasks = await client.ai.tasks();
  let task = tasks.find((t) => t.name === "flux-synergy-task");
  if (!task) task = await client.ai.addTask("flux-synergy-task", "default", taskPrompt, examples);
  return task;
}

async function LLMProcessing(unprocessedItems, subgroups, currentSubgroup, existingTopics) {
  const task = await ensureLLMTask();
  const client: Ad4mClient = await getAd4mClient();
  let prompt = {
    existingTopics: existingTopics.map((t: any) => t.name),
    previousSubgroups: subgroups.map((s: any) => {
      return { name: s.subgroupName, summary: s.summary };
    }),
    currentSubgroup,
    unprocessedItems: unprocessedItems.map((item: any) => {
      return { id: item.baseExpression, text: item.text };
    }),
  };
  // attempt LLM task up to 5 times before giving up
  let parsedData;
  let attempts = 0;
  while (!parsedData && attempts < 5) {
    attempts += 1;
    console.log("LLM Prompt:", prompt);
    const response = await client.ai.prompt(task.taskId, JSON.stringify(prompt));
    console.log("LLM Response: ", response);
    try {
      // todo: include check here to ensure all expected properties are present in the response
      parsedData = JSON5.parse(response);
    } catch (error) {
      console.error("LLM response parse error:", error);
      //@ts-ignore
      prompt.jsonParseError = error;
    }
  }

  if (parsedData) {
    return {
      conversationData: parsedData.conversationData,
      currentSubgroup: parsedData.currentSubgroup,
      newSubgroup: parsedData.newSubgroup,
    };
  } else {
    // give up and return empty data
    console.error("Failed to parse LLM response after 5 attempts. Returning empty data.");
    return {
      conversationData: { name: "", summary: "" },
      currentSubgroup: { name: "", summary: "", topics: [] },
      newSubgroup: { name: "", summary: "", topics: [] },
    };
  }
}

export function transformItem(type, item) {
  // used to transform message, post, or task subject entities into a common format
  const newItem = {
    type,
    baseExpression: item.id,
    author: item.author,
    timestamp: item.timestamp,
    text: "",
    icon: "question",
  };
  if (type === "Message") {
    newItem.text = item.body;
    newItem.icon = "chat";
  } else if (type === "Post") {
    newItem.text = item.title || item.body;
    newItem.icon = "postcard";
  } else if (type === "Task") {
    newItem.text = item.name;
    newItem.icon = "kanban";
  }
  return newItem;
}

export async function findTopics(perspective, itemId) {
  const allRelationships = (await SemanticRelationship.query(perspective, {
    source: itemId,
  })) as any;
  const topicRelationships = allRelationships.filter((r: any) => r.relevance);
  const topics = await Promise.all(
    topicRelationships.map(
      (r) =>
        new Promise(async (resolve) => {
          try {
            const topicEntity = new Topic(perspective, r.tag);
            const topic = await topicEntity.get();
            resolve({
              baseExpression: r.tag,
              name: topic.topic,
              relevance: r.relevance,
            });
          } catch (error) {
            resolve(null);
          }
        })
    )
  );
  return topics.filter((t) => t);
}

export async function getAllTopics(perspective) {
  // gather up all existing topics in the neighbourhood
  return (await Topic.query(perspective)).map((topic: any) => {
    return { baseExpression: topic.baseExpression, name: topic.topic };
  });
}

// todo: use raw prolog query here so subject classes don't need to be hard coded
export async function getSynergyItems(perspective, parentId) {
  // parentId used so we can get items linked to a channel (unprocessed) or conversation
  const messages = await new SubjectRepository(Message, {
    perspective,
    source: parentId,
  }).getAllData();
  const posts = await new SubjectRepository(Post, {
    perspective,
    source: parentId,
  }).getAllData();
  const tasks = await new SubjectRepository("Task", {
    perspective,
    source: parentId,
  }).getAllData();
  // transform items into common format
  const transformedItems = [
    ...messages.map((message) => transformItem("Message", message)),
    ...posts.map((post) => transformItem("Post", post)),
    ...tasks.map((task) => transformItem("Task", task)),
  ];
  // order items by timestamp
  const orderedItems = transformedItems.sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  return orderedItems;
}

export async function getDefaultLLM() {
  const client = await getAd4mClient();
  return await client.ai.getDefaultModel("LLM");
}

export async function findUnprocessedItems(perspective: any, items: any[]) {
  return (
    await Promise.all(
      items.map(async (item) => {
        const parentLinks = await perspective.get(
          new LinkQuery({ predicate: "ad4m://has_child", target: item.baseExpression })
        );
        // unprocessed items should only have a single parent link to the channel (where as processed items will also have a parent link to the conversation)
        return parentLinks.length === 1 ? item : null;
      })
    )
  ).filter(Boolean);
}

async function findItemsAuthor(perspective: any, channelId: string, itemId: string) {
  // find the link connecting the item to the channel
  const itemChannelLinks = await perspective.get(
    new LinkQuery({ source: channelId, predicate: "ad4m://has_child", target: itemId })
  );
  // return the author of the links did
  return itemChannelLinks[0].author;
}

async function isMe(did: string) {
  // checks if the did is mine
  const client = await getAd4mClient();
  const me = await client.agent.me();
  return did === me.did;
}

let receivedSignals: any[] = [];
let signalHandler: ((expression: PerspectiveExpression) => void) | null = null;

async function onSignalReceived(expression: PerspectiveExpression, neighbourhood: NeighbourhoodProxy) {
  const link = expression.data.links[0];
  const { author, data } = link;
  const { predicate, target } = data;

  if (predicate === "can-you-process-items") {
    const defaultLLM = await getDefaultLLM();
    if (defaultLLM) {
      await neighbourhood.sendSignalU(author, { links: [{ source: "", predicate: "i-can-process-items", target }] });
    }
    // todo: respond if can't process items too?
    // await neighbourhood.sendSignalU(author, {
    //   links: [
    //     {
    //       source: "", // channelId (not necissary?)
    //       predicate: `i-${defaultLLM ? "can" : "cant"}-process-items`,
    //       target,
    //     },
    //   ],
    // });
  }

  if (predicate === "i-can-process-items") {
    console.log("Signal recieved: remote agent can process items!");
    receivedSignals.push(link);
  }

  // // is this necissary (might be slightly quicker than waiting for timeout...)
  // if (predicate === "i-cant-process-items") {
  // }
}

export async function addSynergySignalHandler(perspective: PerspectiveProxy) {
  const neighbourhood = await perspective.getNeighbourhoodProxy();
  signalHandler = (expression: PerspectiveExpression) => onSignalReceived(expression, neighbourhood);
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
  return new Promise(async (resolve) => {
    // generate a uuid to ensure responce matches request
    const signalUuid = uuidv4();
    // signal the agent to check they are online and have AI enabled
    await neighbourhood.sendSignalU(agentsDid, {
      links: [{ source: "", predicate: "can-you-process-items", target: signalUuid }],
    });
    // wait 2 seconds for a responce
    setTimeout(() => {
      const affirmationRecieved = !!receivedSignals.find((signal: any) => signal.data.target === signalUuid);
      resolve(affirmationRecieved);
    }, 3000);
  });
}
// todo: store these consts in channel settings
const minNumberOfItemsToProcess = 5;
const numberOfItemsDelay = 3;

async function responsibleForProcessing(
  perspective: PerspectiveProxy,
  neighbourhood: NeighbourhoodProxy,
  channelId: string,
  unprocessedItems: any[],
  increment = 0
): Promise<boolean> {
  // check if enough unprocessed items are present to run the processing task (increment used so we can keep checking the next item until the limit is reached)
  const enoughUnprocessedItems = unprocessedItems.length >= minNumberOfItemsToProcess + numberOfItemsDelay + increment;
  if (!enoughUnprocessedItems) {
    console.log("not enough items to process");
    return false;
  } else {
    // find the author of the nth item
    const nthItem = unprocessedItems[minNumberOfItemsToProcess + increment - 1];
    const author = await findItemsAuthor(perspective, channelId, nthItem.baseExpression);
    // if we are the author, we are responsible for processing
    if (await isMe(author)) {
      console.log("we are the author of the nth item!");
      return true;
    } else {
      // if not, signal the author to check if they can process the items
      const authorCanProcessItems = await agentCanProcessItems(neighbourhood, author);
      console.log("author can process items:", authorCanProcessItems);
      // if they can, we aren't responsible for processing
      if (authorCanProcessItems) return false;
      else {
        // if they can't, re-run the check on the next item
        return await responsibleForProcessing(perspective, neighbourhood, channelId, unprocessedItems, increment + 1);
      }
    }
  }
}

async function findOrCreateNewConversation(perspective: PerspectiveProxy, channelId: string) {
  const conversations = await Conversation.query(perspective, { source: channelId });
  if (conversations.length) {
    // if existing conversations found & last item in last conversation less than 30 mins old, use that conversation
    const lastConversation = conversations[conversations.length - 1];
    const lastConversationItems = await getSynergyItems(perspective, lastConversation.baseExpression);
    if (lastConversationItems.length) {
      const lastItem = lastConversationItems[lastConversationItems.length - 1];
      const timeSinceLastItemCreated = new Date().getTime() - new Date(lastItem.timestamp).getTime();
      const minsSinceLastItemCreated = timeSinceLastItemCreated / (1000 * 60);
      if (minsSinceLastItemCreated < 30) return lastConversation;
    }
  }
  // otherwise create a new conversation
  const newConversation = new Conversation(perspective, undefined, channelId);
  newConversation.conversationName = "Generating conversation...";
  await newConversation.save();
  return await newConversation.get();
}

// todo:
// + gather up save, update, and link creating tasks (after conversation creation) and run all in Promise.all() at function end (be aware that some need baseExpressions of previously created subject classes)
// + let other agents know when you have started & finished processing (add new signal in responsibleForProcessing check?)
// + mark individual items as processing in UI
let processing = false;
async function processItemsAndAddToConversation(perspective, channelId, unprocessedItems) {
  processing = true;
  const conversation: any = await findOrCreateNewConversation(perspective, channelId);
  // gather up all new perspective links so they can be commited in a single transaction at the end of the function
  const newLinks = [] as any;
  // prepare links connecting items to conversation
  newLinks.push(
    ...unprocessedItems.map((item) => ({
      source: conversation.baseExpression,
      predicate: "ad4m://has_child",
      target: item.baseExpression,
    }))
  );
  // gather up data for LLM processing
  const previousSubgroups = await ConversationSubgroup.query(perspective, { source: conversation.baseExpression });
  const lastSubgroup = previousSubgroups[previousSubgroups.length - 1];
  const lastSubgroupTopics = lastSubgroup ? await findTopics(perspective, lastSubgroup.baseExpression) : [];
  const lastSubgroupWithTopics = lastSubgroup ? { ...lastSubgroup, topics: lastSubgroupTopics } : null;
  const existingTopics = await getAllTopics(perspective);
  // run LLM processing
  const { conversationData, currentSubgroup, newSubgroup } = await LLMProcessing(
    unprocessedItems,
    previousSubgroups,
    lastSubgroupWithTopics,
    existingTopics
  );
  // update conversation text
  conversation.conversationName = conversationData.name;
  conversation.summary = conversationData.summary;
  await conversation.update();
  // gather up topics returned from LLM
  const allReturnedTopics = [];
  if (currentSubgroup) allReturnedTopics.push(...currentSubgroup.topics);
  if (newSubgroup) allReturnedTopics.push(...newSubgroup.topics);
  // filter out duplicates & existing topics
  const newTopicsToCreate = allReturnedTopics.reduce((acc, topic) => {
    const unique = !acc.some((t) => t.name === topic.name) && !existingTopics.some((t) => t.name === topic.name);
    if (unique) acc.push(topic);
    return acc;
  }, []);
  // create new topics and store them in newTopics array for later use
  const newTopics = await Promise.all(
    newTopicsToCreate.map(async (topic: any) => {
      // create topic
      const newTopic = new Topic(perspective);
      newTopic.topic = topic.name;
      await newTopic.save();
      const newTopicEntity = await newTopic.get();
      return { baseExpression: newTopicEntity.baseExpression, name: topic.name };
    })
  );
  // link all returned topics to conversation
  const conversationTopics = await findTopics(perspective, conversation.baseExpression);
  await Promise.all(
    allReturnedTopics.map(
      (topic) =>
        new Promise(async (resolve: any) => {
          // skip topics already linked to the conversation
          if (!conversationTopics.find((t) => t.name === topic.name)) {
            // find the topic entity from newTopics or existingTopics arrays so we access its baseExpression (not returned from LLM)
            const topicEntity =
              newTopics.find((t) => t.name === topic.name) || existingTopics.find((t) => t.name === topic.name);
            await linkTopic(perspective, conversation.baseExpression, topicEntity.baseExpression, topic.relevance);
          }
          resolve();
        })
    )
  );
  // update currentSubgroup if new data returned from LLM
  const currentSubgroupEntity = previousSubgroups[previousSubgroups.length - 1] as any;
  if (currentSubgroup) {
    currentSubgroupEntity.subgroupName = currentSubgroup.name;
    currentSubgroupEntity.summary = currentSubgroup.summary;
    // link currentSubgroup topics
    await Promise.all(
      currentSubgroup.topics.map(
        (topic) =>
          new Promise(async (resolve: any) => {
            const topicEntity =
              newTopics.find((t) => t.name === topic.name) || existingTopics.find((t) => t.name === topic.name);
            await linkTopic(
              perspective,
              currentSubgroupEntity.baseExpression,
              topicEntity.baseExpression,
              topic.relevance
            );
            resolve();
          })
      )
    );
  }
  // create new subgroup if returned from LLM
  let newSubgroupEntity;
  if (newSubgroup) {
    newSubgroupEntity = new ConversationSubgroup(perspective, undefined, conversation.baseExpression);
    newSubgroupEntity.subgroupName = newSubgroup.name;
    newSubgroupEntity.summary = newSubgroup.summary;
    await newSubgroupEntity.save();
    newSubgroupEntity = await newSubgroupEntity.get();
    // prepare link connecting subgroup to conversation
    newLinks.push({
      source: conversation.baseExpression,
      predicate: "ad4m://has_child",
      target: newSubgroupEntity.baseExpression,
    });
    // link new subgroup topics
    await Promise.all(
      newSubgroup.topics.map(
        (topic) =>
          new Promise(async (resolve: any) => {
            const topicEntity =
              newTopics.find((t) => t.name === topic.name) || existingTopics.find((t) => t.name === topic.name);
            await linkTopic(perspective, newSubgroupEntity.baseExpression, topicEntity.baseExpression, topic.relevance);
            resolve();
          })
      )
    );
  }
  // link items to subgroups
  const indexOfFirstItemInNewSubgroup =
    newSubgroup && unprocessedItems.findIndex((item) => item.id === newSubgroup.firstItemId);
  await Promise.all(
    unprocessedItems.map(
      (item, itemIndex) =>
        new Promise(async (resolve: any) => {
          // find the items subgroup
          let itemsSubgroup = currentSubgroupEntity;
          if (newSubgroup && itemIndex >= indexOfFirstItemInNewSubgroup) itemsSubgroup = newSubgroupEntity;
          // prepare links connecting item to subgroup
          newLinks.push({
            source: itemsSubgroup.baseExpression,
            predicate: "ad4m://has_child",
            target: item.baseExpression,
          });
          resolve();
        })
    )
  );
  // create vector embeddings for each unprocessed item
  await Promise.all(unprocessedItems.map((item) => createEmbedding(perspective, item.text, item.baseExpression)));
  // update vector embedding for conversation
  await removeEmbedding(perspective, conversation.baseExpression);
  await createEmbedding(perspective, conversationData.summary, conversation.baseExpression);
  // update vector embedding for currentSubgroup if returned from LLM
  if (currentSubgroup) {
    await removeEmbedding(perspective, currentSubgroupEntity.baseExpression);
    await createEmbedding(perspective, currentSubgroup.summary, currentSubgroupEntity.baseExpression);
  }
  // create vector embedding for new subgroup if returned from LLM
  if (newSubgroup) await createEmbedding(perspective, newSubgroup.summary, newSubgroupEntity.baseExpression);
  // batch commit all new links (currently only "ad4m://has_child" links)
  await perspective.addLinks(newLinks);
  processing = false;
}

export async function runProcessingCheck(perspective: PerspectiveProxy, channelId: string) {
  console.log("runProcessingCheck");
  return new Promise(async (resolve: any) => {
    // only attempt processing if default LLM is set
    const defaultLLM = await getDefaultLLM();
    if (!defaultLLM) resolve();
    else {
      // check if we are responsible for processing
      const channelItems = await getSynergyItems(perspective, channelId);
      const unprocessedItems = await findUnprocessedItems(perspective, channelItems);
      const neighbourhood = await perspective.getNeighbourhoodProxy();
      const responsible: boolean = await responsibleForProcessing(
        perspective,
        neighbourhood,
        channelId,
        unprocessedItems
      );
      console.log("responsible for processing", responsible);
      // if we are responsible, process items (minus delay) & add to conversation
      if (responsible && !processing)
        await processItemsAndAddToConversation(perspective, channelId, unprocessedItems.slice(0, -numberOfItemsDelay));
      resolve();
    }
  });
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
