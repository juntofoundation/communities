import { Ad4mClient, AITask, LinkQuery } from "@coasys/ad4m";
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

async function removeEmbedding(perspective, itemId) {
  const allRelationships = (await SemanticRelationship.query(perspective, {
    source: itemId,
  })) as any;
  const embeddingRelationship = allRelationships.find((r) => !r.relevance);
  if (embeddingRelationship) {
    const embedding = new Embedding(perspective, embeddingRelationship.tag);
    await embedding.delete();
    await embeddingRelationship.delete();
  }
}

async function removeTopics(perspective, itemId) {
  const allRelationships = (await SemanticRelationship.query(perspective, {
    source: itemId,
  })) as any;
  const topicRelationships = allRelationships.filter((r) => r.relevance);
  return Promise.all(
    topicRelationships.map(
      async (topicRelationship) =>
        new Promise(async (resolve: any) => {
          try {
            const topic = new Topic(perspective, topicRelationship.tag);
            await topic.delete();
            await topicRelationship.delete();
            resolve();
          } catch (error) {
            resolve();
          }
        })
    )
  );
}

async function removeProcessedData(perspective, itemId) {
  return await Promise.all([
    removeEmbedding(perspective, itemId),
    removeTopics(perspective, itemId),
  ]);
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

async function findOrCreateTopic(perspective, allTopics, topicName) {
  let topicId;
  // check if topic already exists
  const match = allTopics.find((t) => t.name === topicName);
  if (match) topicId = match.baseExpression;
  else {
    // create topic
    const newTopic = new Topic(perspective);
    newTopic.topic = topicName;
    await newTopic.save();
    topicId = newTopic.baseExpression;
  }
  return topicId;
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
    I'm passing you a JSON object with the following properties: 'previousSubgroups' (string block broken up into sections by line breaks <br/>), 'previousMessages' (string array), 'newMessage' (string), and 'existingTopics' (string array).
    { previousSubgroups: [], previousMessages: [], newMessage: 'Some text', existingTopics: [] }
    Firstly, analyze the 'newMessage' string and identify between 1 and 5 topics (each a single word string in lowercase) that are relevant to the content of the 'newMessage' string. If any of the topics you choose are similar to topics listed in the 'existingTopics' array, use the existing topic instead of creating a new one (e.g., if one of the new topics you picked was 'foods' and you find an existing topic 'food', use 'food' instead of creating a new topic that is just a plural version of the existing topic). For each topic, provide a relevance score between 0 and 100 (0 being irrelevant and 100 being highly relevant) that indicates how relevant the topic is to the content of the 'newMessage' string.
    Secondly, compare the 'newMessage' with the content of 'previousMessages'. Consider the conversation as **related** if:
    - The 'newMessage' discusses, contrasts, or expands upon topics present in 'previousMessages'.
    - The 'newMessage' introduces new angles, comparisons, or opinions on the same topics discussed in 'previousMessages' (even if specific terms or phrases differ).
    Only consider the conversation as having **shifted to a new subject** if:
    - The 'newMessage' introduces entirely new topics, concepts, or themes that are not directly related to any topics discussed or implied in 'previousMessages'.
    - The 'newMessage' does not logically connect or refer back to the themes in the 'previousMessages'.
    If there are no items in the 'previousMessages' array, the conversation has by default shifted.
    After this analysis, return a new object with the following properties and nothing else:
    1. **'topics'**: an array of objects for each of the topics you have identified for the 'newMessage'. Each object should contain a 'name' property (string) for the name of the topic and a 'relevance' property (number) for its relevance score.
    2. **'changedSubject'**: a boolean value that indicates whether the conversation has shifted to a new subject or not. The conversation should be considered as shifted only if there is no significant overlap between the topics in the 'newMessage' and the topics in the 'previousMessages'.
    3. **'newSubgroupName'**: a 1 to 3 word title (string) for the conversation describing its contents. If changedSubject is true, base the title solely on the new message, otherwise base it on both the new message and the last messages. Don't reference previous conversations.
    4. **'newSubgroupSummary'**: a 1 to 3 sentence paragraph (string) summary of the conents of the conversation. If changedSubject is true, base the summary solely on the new message, otherwise base it on both the new message and the last messages. Don't reference previous conversations.
    5. **'newConversationName'**: a 1 to 3 word title (string) describing the contents of the previousSubgroups plus the newSubgroupSummary. Don't reference previous conversations.
    6. **'newConversationSummary'**: a 1 to 3 sentence paragraph (string) summary of the the previousSubgroups plus the newSubgroupSummary. Don't reference previous conversations.
    Make sure the response is in a format that can be parsed using JSON.parse(). Don't wrap it in code syntax, don't append text outside of quotes, don't use the assign operator ("=").
    If you make a mistake and we can't parse you're output, I will give you the same input again, plus another field "jsonParseError" holding the error we got from JSON.parse().
    So if you see that field, take extra care about that specific mistake and don't make it again!
    Don't talk about the errors in the summaries or topics.
  `;

  const examples = [
    {
      input: `{ previousSubgroups: [], previousMessages: [], newMessage: 'hello world', existingTopics: [greeting] }`,
      output: `{"topics":[{"name":"greeting","relevance":100}],"changedSubject":true,"newSubgroupName":"Hello World","newSubgroupSummary":"The conversation starts with a simple greeting: 'hello world'.","newConversationName":"Hello World","newConversationSummary":"The conversation starts with a simple greeting: 'hello world'."}`,
    },
    {
      input: `{ previousSubgroups: [The conversation starts with a simple greeting: 'hello world'.], previousMessages: [<p>hello world</p><p></p>], newMessage: 'another hello 2', existingTopics: [greeting] }`,
      output: `{"topics":[{"name":"hello","relevance":80},{"name":"greeting","relevance":70}],"changedSubject":false,"newSubgroupName":"More Greetings","newSubgroupSummary":"The conversation continues with another greeting, showing the ongoing exchange of pleasantries.","newConversationName":"Simple Greetings","newConversationSummary":"The conversation starts with a simple greeting: 'hello world'. Following this, another greeting is exchanged, indicating the continuation of pleasantries."}`,
    },
    {
      input: `{ previousSubgroups: [The conversation continues with another greeting, showing the ongoing exchange of pleasantries.], previousMessages: [<p>hello world</p><p></p>, <p>another hello 2</p><p></p>], newMessage: 'game talk here', existingTopics: [greeting, hello] }`,
      output: `{"topics":[{"name":"game","relevance":100},{"name":"talk","relevance":80}],"changedSubject":true,"newSubgroupName":"Game Talk","newSubgroupSummary":"The conversation introduces a new topic with a focus on discussing games.","newConversationName":"Exchange of Pleasantries and Game Talk","newConversationSummary":"The conversation continues with another greeting, showing the ongoing exchange of pleasantries. The conversation then introduces a new topic with a focus on discussing games."}`,
    },
    {
      input: `{ previousSubgroups: [The conversation continues with another greeting, showing the ongoing exchange of pleasantries. <br/> The conversation introduces a new topic with a focus on discussing games.], previousMessages: [<p>game talk here</p><p></p>], newMessage: 'dota 2 is the biggest esport game there is', existingTopics: [greeting, hello, game, talk] }`,
      output: `{"topics":[{"name":"game","relevance":90},{"name":"esport","relevance":85},{"name":"dota","relevance":100}],"changedSubject":false,"newSubgroupName":"Dota 2 Discussion","newSubgroupSummary":"The conversation continues with a focus on Dota 2, highlighting its prominence in the esports scene.","newConversationName":"Games and Esports","newConversationSummary":"The conversation continues with another greeting, showing the ongoing exchange of pleasantries. The conversation introduces a new topic with a focus on discussing games. The latest discussion centers on Dota 2, highlighting its significance in the world of esports."}`,
    },
  ];

  const client: Ad4mClient = await getAd4mClient();
  const tasks = await client.ai.tasks();
  let task = tasks.find((t) => t.name === "flux-synergy-task");
  if (!task) task = await client.ai.addTask("flux-synergy-task", "default", taskPrompt, examples);
  return task;
}

async function LLMProcessing(newItem, latestSubgroups, latestSubgroupItems, allTopics) {
  let prompt = {
    previousSubgroups: [latestSubgroups.map((s: any) => s.summary).join(" <br/> ")],
    previousMessages: [latestSubgroupItems.map((si: any) => si.text).join(", ")],
    newMessage: newItem.text,
    existingTopics: [allTopics.map((t: any) => t.name).join(", ")],
  };

  const task = await ensureLLMTask();
  const client: Ad4mClient = await getAd4mClient();
  let parsedData;
  let attempts = 0;
  while (!parsedData && attempts < 5) {
    attempts += 1;
    console.log("LLM Prompt:", prompt);
    const response = await client.ai.prompt(task.taskId, JSON.stringify(prompt));
    console.log("LLM Response: ", response);
    response.replace("False", "false");
    response.replace("True", "true");
    try {
      parsedData = JSON5.parse(response);
    } catch (error) {
      console.error("LLM response parse error:", error);
      //@ts-ignore
      prompt.jsonParseError = error;
    }
  }

  if (parsedData) {
    return {
      topics: parsedData.topics || [],
      changedSubject: parsedData.changedSubject || false,
      newSubgroupName: parsedData.newSubgroupName || "",
      newSubgroupSummary: parsedData.newSubgroupSummary || "",
      newConversationName: parsedData.newConversationName || "",
      newConversationSummary: parsedData.newConversationSummary || "",
    };
  } else {
    // give up and return empty data
    console.error("Failed to parse LLM response after 5 attempts. Returning empty data.");
    return {
      topics: [],
      changedSubject: false,
      newSubgroupName: "",
      newSubgroupSummary: "",
      newConversationName: "",
      newConversationSummary: "",
    };
  }
}

export function transformItem(type, item) {
  // used to transform message, post, or task expressions into a common format
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

export async function getSubgroupItems(perspective, subgroupId) {
  const messages = await new SubjectRepository(Message, {
    perspective,
    source: subgroupId,
  }).getAllData();
  const posts = await new SubjectRepository(Post, {
    perspective,
    source: subgroupId,
  }).getAllData();
  const tasks = await new SubjectRepository("Task", {
    perspective,
    source: subgroupId,
  }).getAllData();
  return [
    ...messages.map((message) => transformItem("Message", message)),
    ...posts.map((post) => transformItem("Post", post)),
    ...tasks.map((task) => transformItem("Task", task)),
  ].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
}

export async function processItem(perspective, channelId, item, existingItem?: boolean) {
  // check if LLM is enabled
  const client = await getAd4mClient();
  const defaultLLM = await client.ai.getDefaultModel("LLM");
  console.log("process item with LLM: ", !!defaultLLM);
  return new Promise(async (resolve: any) => {
    // check for existing relationships & removed processed data if present (used for edits & unprocessed items)
    const relationships = await SemanticRelationship.query(perspective, {
      source: item.baseExpression,
    });
    if (relationships.length) await removeProcessedData(perspective, item.baseExpression);
    // find the last conversation & subgroup or create new ones
    let conversation;
    let subgroups = [] as any;
    let subgroupItems = [] as any[];
    const conversations = await Conversation.query(perspective, {
      source: channelId,
    });
    if (conversations.length) {
      if (existingItem) {
        // find the conversation & subgroup of the existing item
        const allConversations = await Conversation.all(perspective);
        const allSubgroups = await ConversationSubgroup.all(perspective);
        const itemLinks = await perspective.get(
          new LinkQuery({
            predicate: "ad4m://has_child",
            target: item.baseExpression,
          })
        );
        const subgroup = allSubgroups.find((s) =>
          itemLinks.find((link) => link.data.source === s.baseExpression)
        );
        const subgroupLinks = await perspective.get(
          new LinkQuery({
            predicate: "ad4m://has_child",
            target: subgroup.baseExpression,
          })
        );
        conversation = allConversations.find((c) =>
          subgroupLinks.find((link) => link.data.source === c.baseExpression)
        );
        subgroups = [subgroup];
      } else {
        // find the latest conversation & subgroup (if last item created less than 30 mins ago)
        const latestConversation = conversations[conversations.length - 1];
        subgroups = await ConversationSubgroup.query(perspective, {
          source: latestConversation.baseExpression,
        });
        const latestSubgroup = subgroups[subgroups.length - 1] as any;
        const latestSubgroupItems = await getSubgroupItems(
          perspective,
          latestSubgroup.baseExpression
        );
        // calculate time since last item was created
        const lastItem = latestSubgroupItems[latestSubgroupItems.length - 1];
        if (lastItem) {
          const minsSinceLastItemCreated =
            (new Date().getTime() - new Date(lastItem.timestamp).getTime()) / (1000 * 60);
          if (minsSinceLastItemCreated < 30) {
            // if less than 30 mins, consider the new item part of the latest conversation
            conversation = latestConversation;
            subgroupItems = latestSubgroupItems;
          }
        }
      }
    }
    if (!conversation) {
      // create new conversation
      const newConversation = new Conversation(perspective, undefined, channelId);
      newConversation.conversationName = `Conversation ${conversations.length + 1}`;
      await newConversation.save();
      conversation = await newConversation.get();
      // create new subgroup
      const newSubgroup = new ConversationSubgroup(
        perspective,
        undefined,
        conversation.baseExpression
      );
      newSubgroup.subgroupName = "Subgroup 1";
      await newSubgroup.save();
      subgroups = [newSubgroup];
      // link subgroup to channel for use in search
      await perspective.add({
        source: channelId,
        predicate: "ad4m://has_child",
        target: newSubgroup.baseExpression,
      });
    }
    // attach unprocessed item to subgroup (unless existingItem)
    let subgroup = subgroups[subgroups.length - 1];
    let linkExpression;
    if (!existingItem) {
      linkExpression = await perspective.add({
        source: subgroup.baseExpression,
        predicate: "ad4m://has_child",
        target: item.baseExpression,
      });
    }
    if (!defaultLLM) resolve();
    else {
      // mark items as processing by adding an empty semantic relationship
      const relationship = new SemanticRelationship(perspective, undefined, item.baseExpression);
      await relationship.save();
      // run LLM processing
      const allTopics = await getAllTopics(perspective);
      const {
        topics,
        changedSubject,
        newSubgroupName,
        newSubgroupSummary,
        newConversationName,
        newConversationSummary,
      } = await LLMProcessing(item, subgroups, subgroupItems, allTopics);
      if (!existingItem) {
        // update conversation summary and title
        if (newConversationName) conversation.conversationName = newConversationName;
        if (newConversationSummary) conversation.summary = newConversationSummary;
        if (newConversationName || newConversationSummary) await conversation.update();
        // update subgroup summary and title
        if (changedSubject && subgroup.summary) {
          // if the conversation has shifted to a new subject, create a new subgroup
          const newSubgroup = new ConversationSubgroup(
            perspective,
            undefined,
            conversation.baseExpression
          );
          newSubgroup.subgroupName = newSubgroupName;
          newSubgroup.summary = newSubgroupSummary;
          await newSubgroup.save();
          // link subgroup to channel for use in search
          await perspective.add({
            source: channelId,
            predicate: "ad4m://has_child",
            target: newSubgroup.baseExpression,
          });
          // remove link to old subgroup if present
          if (linkExpression) await perspective.remove(linkExpression);
          // add link to new subgroup
          await perspective.add({
            source: newSubgroup.baseExpression,
            predicate: "ad4m://has_child",
            target: item.baseExpression,
          });
          subgroup = newSubgroup;
        } else {
          // if the subject of the conversation has stayed the same, stick with the exising subgroup
          if (newSubgroupName) subgroup.subgroupName = newSubgroupName;
          if (newSubgroupSummary) subgroup.summary = newSubgroupSummary;
          if (newSubgroupName || newSubgroupSummary) await subgroup.update();
        }
      }
      // attach topics to new item, conversation, & subgroup (avoid duplicates on conversation & subgroup)
      const filteredTopics = topics.filter((topic: any) => topic && topic.name && topic.relevance);
      await Promise.all(
        filteredTopics.map(
          (topic: any) =>
            new Promise(async (resolve2: any) => {
              // link new item topics
              const topicId = await findOrCreateTopic(perspective, allTopics, topic.name);
              await linkTopic(perspective, item.baseExpression, topicId, topic.relevance);
              // link new conversation topics
              const conversationTopics = await findTopics(perspective, conversation.baseExpression);
              if (!conversationTopics.find((t) => t.name === topic.name)) {
                await linkTopic(perspective, conversation.baseExpression, topicId, topic.relevance);
              }
              // link new subgroup topics
              const subgroupTopics = await findTopics(perspective, subgroup.baseExpression);
              if (!subgroupTopics.find((t) => t.name === topic.name)) {
                await linkTopic(perspective, subgroup.baseExpression, topicId, topic.relevance);
              }
              resolve2();
            })
        )
      );
      // update embeddings
      await removeEmbedding(perspective, item.baseExpression);
      await createEmbedding(perspective, item.text, item.baseExpression);
      if (!existingItem) {
        await removeEmbedding(perspective, conversation.baseExpression);
        await createEmbedding(perspective, newConversationSummary, conversation.baseExpression);
        await removeEmbedding(perspective, subgroup.baseExpression);
        await createEmbedding(perspective, newSubgroupSummary, subgroup.baseExpression);
      }

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
