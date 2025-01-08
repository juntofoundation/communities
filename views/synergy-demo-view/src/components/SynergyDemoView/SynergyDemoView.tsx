import { LinkQuery } from "@coasys/ad4m";
import { AgentClient } from "@coasys/ad4m/lib/src/agent/AgentClient";
import {
  Channel,
  Conversation,
  ConversationSubgroup,
  Embedding,
  SemanticRelationship,
  SubjectRepository,
  Topic,
} from "@coasys/flux-api";
import { getAllTopics } from "@coasys/flux-utils";
import WebRTCView from "@coasys/flux-webrtc-view/src/App";
import { cos_sim } from "@xenova/transformers";
import { useEffect, useRef, useState } from "preact/hooks";
import MatchColumn from "../MatchColumn";
import TimelineColumn from "../TimelineColumn";
import styles from "./SynergyDemoView.module.scss";

type Props = {
  perspective: any;
  source: string;
  agent: AgentClient;
};

export default function SynergyDemoView({ perspective, agent, source }: Props) {
  const [matches, setMatches] = useState<any[]>([]);
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<any>({});
  const [searchItem, setSearchItem] = useState<any>({});
  const [searching, setSearching] = useState(false);
  const [searchType, setSearchType] = useState("");
  const [filterSettings, setFilterSettings] = useState({
    grouping: "Conversations",
    itemType: "All Types",
    includeChannel: false,
  });
  const [showMatchColumn, setShowMatchColumn] = useState(false);

  function entryTypeToSubjectClass(entryType: string) {
    if (entryType === "flux://conversation") return "Conversation";
    else if (entryType === "flux://conversation_subgroup") return "ConversationSubgroup";
    else if (entryType === "flux://has_message") return "Message";
    else if (entryType === "flux://has_post") return "Post";
    else return "Unknown";
  }

  async function findEntryType(itemId) {
    const entryTypeLink = await perspective.get(
      new LinkQuery({ source: itemId, predicate: "flux://entry_type" })
    );
    if (!entryTypeLink[0]) return "Task";
    else return entryTypeToSubjectClass(entryTypeLink[0].data.target);
  }

  async function findChannel(itemId, channels) {
    const parentLinks = await perspective.get(
      new LinkQuery({ predicate: "ad4m://has_child", target: itemId })
    );
    return (
      channels.find((c) => parentLinks.find((p) => p.data.source === c.id)) || {
        id: "unlinked",
      }
    );
  }

  async function findEmbeddingMatches(
    itemId: string,
    allowedTypes: string[],
    channels: any[]
  ): Promise<any[]> {
    // searches for items in the neighbourhood that match the search filters & have similar embedding scores
    return await new Promise(async (resolveMatches: any) => {
      // grab all embedding relationships
      const allEmbeddingRelationships = (await SemanticRelationship.all(perspective)).filter(
        (r) => !r.relevance
      );
      // find the source embedding
      const sourceEmbeddingRelationship = allEmbeddingRelationships.find(
        (r) => r.expression === itemId
      );
      const sourceEmbeddingEntity = new Embedding(perspective, sourceEmbeddingRelationship.tag);
      const sourceEmbedding = JSON.parse((await sourceEmbeddingEntity.get()).embedding);
      // loop through others & apply search filters
      const embeddingRelationships = allEmbeddingRelationships.filter(
        (r) => r.expression !== itemId
      );
      const matches = await Promise.all(
        embeddingRelationships.map(async (relationship: any) => {
          const { expression, tag } = relationship;
          // if it doesn't match the search filters return null
          const channel = await findChannel(expression, channels);
          const type = await findEntryType(expression);
          const wrongChannel = !filterSettings.includeChannel && channel.id === source;
          const wrongType = !allowedTypes.includes(type);
          if (wrongChannel || wrongType) return null;
          // otherwise return the matching expression with its similarity score
          const embeddingEntity = new Embedding(perspective, tag);
          const embedding = JSON.parse((await embeddingEntity.get()).embedding);
          const score = await cos_sim(sourceEmbedding, embedding);
          return { baseExpression: expression, channel, type, score };
        })
      );
      resolveMatches(matches.filter((item) => item && item.score > 0.2));
    });
  }

  async function findTopicMatches(
    topicId: string,
    allowedTypes: string[],
    channels: any[]
  ): Promise<any[]> {
    // searches for items in the neighbourhood that match the search filters & are linked to the same topic
    return await new Promise(async (resolveMatches: any) => {
      const allRelationships = await SemanticRelationship.all(perspective);
      const topicRelationships = allRelationships.filter((r) => r.tag === topicId);
      const matches = await Promise.all(
        topicRelationships.map(async (relationship) => {
          const { expression, relevance } = relationship;
          // if it doesn't match the search filters return null
          const channel = await findChannel(expression, channels);
          const type = await findEntryType(expression);
          const wrongChannel = !filterSettings.includeChannel && channel.id === source;
          const wrongType = !allowedTypes.includes(type);
          if (wrongChannel || wrongType) return null;
          // otherwise return the matching expression
          return { baseExpression: expression, channel, type, score: relevance / 100 };
        })
      );
      resolveMatches(matches.filter((i) => i !== null));
    });
  }

  function findAllowedTypes() {
    const allowedTypes = [];
    const { grouping, itemType } = filterSettings;
    if (grouping === "Conversations") allowedTypes.push("Conversation");
    else if (grouping === "Subgroups") allowedTypes.push("ConversationSubgroup");
    else if (grouping === "Items") {
      if (itemType === "All Types") allowedTypes.push("Message", "Post", "Task");
      else if (itemType === "Messages") allowedTypes.push("Message");
      else if (itemType === "Posts") allowedTypes.push("Post");
      else if (itemType === "Tasks") allowedTypes.push("Task");
    }
    return allowedTypes;
  }

  async function search(type: string, item: any) {
    setSearching(true);
    setMatches([]);
    setShowMatchColumn(true);
    setSearchType(type);
    setSearchItem(item);
    setSelectedTopic(type === "topic" ? item : {});
    const allowedTypes = findAllowedTypes();
    const channels = (await new SubjectRepository(Channel, {
      perspective,
    }).getAllData()) as any;
    const newMatches =
      type === "topic"
        ? await findTopicMatches(item.baseExpression, allowedTypes, channels)
        : await findEmbeddingMatches(item.baseExpression, allowedTypes, channels);
    const sortedMatches = newMatches.sort((a, b) => b.score - a.score);
    setMatches(sortedMatches);
    setSearching(false);
  }

  function matchText() {
    if (!searchType) return "";
    if (searching) return "Searching for matches...";
    if (matches.length === 0)
      return `No ${searchType} matches ${searchType === "topic" ? `for #${selectedTopic.name}` : ""}`;
    return `${matches.length} match${matches.length > 1 ? "es" : ""} ${searchType === "topic" ? `for #${selectedTopic.name}` : ""}`;
  }

  // get all topic tags on page load
  useEffect(() => {
    getAllTopics(perspective).then((topics: any[]) => setAllTopics(topics));
  }, []);

  // update search results when filters change
  useEffect(() => {
    if (searchItem.baseExpression) search(searchType, searchItem);
  }, [filterSettings]);

  // reset matches when channel changes
  useEffect(() => setMatches([]), [source]);

  // temp: ensure SDNA classes
  useEffect(() => {
    perspective.ensureSDNASubjectClass(Conversation);
    perspective.ensureSDNASubjectClass(ConversationSubgroup);
    perspective.ensureSDNASubjectClass(Topic);
    perspective.ensureSDNASubjectClass(Embedding);
    perspective.ensureSDNASubjectClass(SemanticRelationship);
    console.log("SNDA classes ensured");
  }, []);

  return (
    <div className={styles.wrapper}>
      <j-text uppercase size="500" weight="800" color="primary-500">
        Synergy Demo
      </j-text>
      <j-flex gap="400" wrap style={{ width: "100%" }}>
        All topics:
        {allTopics.map((t) => (
          <j-text nomargin>#{t.name}</j-text>
        ))}
      </j-flex>
      <j-flex className={styles.content}>
        <div
          style={{
            width: showMatchColumn ? "33%" : "50%",
            transition: "width 0.5s ease-in-out",
          }}
        >
          <TimelineColumn
            agent={agent}
            perspective={perspective}
            channelId={source}
            selectedTopicId={selectedTopic.baseExpression}
            search={search}
          />
        </div>
        <div
          style={{
            width: showMatchColumn ? "33%" : "50%",
            transition: "width 0.5s ease-in-out",
          }}
        >
          <WebRTCView
            perspective={perspective}
            source={source}
            agent={agent}
            currentView="@coasys/flux-synergy-demo-view"
          />
        </div>
        <div
          style={{
            width: showMatchColumn ? "33%" : "0%",
            opacity: showMatchColumn ? "1" : "0",
            pointerEvents: showMatchColumn ? "all" : "none",
            transition: "all 0.5s ease-in-out",
          }}
        >
          <MatchColumn
            perspective={perspective}
            agent={agent}
            matches={matches}
            selectedTopicId={selectedTopic.baseExpression}
            filterSettings={filterSettings}
            setFilterSettings={setFilterSettings}
            matchText={matchText}
            close={() => setShowMatchColumn(false)}
          />
        </div>
      </j-flex>
    </div>
  );
}
