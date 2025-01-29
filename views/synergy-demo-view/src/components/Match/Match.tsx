import { useEffect, useState } from "preact/hooks";
import { ChevronDownSVG, ChevronUpSVG, getConversationData } from "../../utils";
import TimelineBlock from "../TimelineBlock";
import styles from "./Match.module.scss";

type Props = {
  perspective: any;
  agent: any;
  match: any;
  index: number;
  selectedTopicId: string;
};

export default function Match({ perspective, agent, match, index, selectedTopicId }: Props) {
  const { channel } = match;
  const [conversations, setConversations] = useState([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [collapseBefore, setCollapseBefore] = useState(true);
  const [collapseAfter, setCollapseAfter] = useState(true);

  useEffect(() => {
    getConversationData(perspective, channel.id, match, setMatchIndex).then((data) =>
      setConversations(data.conversations)
    );
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.fades}>
        <div className={styles.fadeTop} />
        <div className={styles.fadeBottom} />
        <div className={styles.line} />
      </div>
      <h2 className={styles.channelName}>{channel.name}</h2>
      {conversations.length > 0 ? (
        <div id={`timeline-${index + 1}`} className={styles.items}>
          {matchIndex > 0 && collapseBefore && (
            <div className={styles.expandButtonWrapper} style={{ marginBottom: 20 }}>
              <div className={styles.expandButton}>
                <j-button onClick={() => setCollapseBefore(false)}>
                  See more
                  <span>
                    <ChevronUpSVG /> {matchIndex}
                  </span>
                </j-button>
              </div>
            </div>
          )}
          {conversations
            .filter((conversation: any, i) => {
              if (collapseBefore && collapseAfter) return i === matchIndex;
              else if (collapseBefore) return i >= matchIndex;
              else if (collapseAfter) return i <= matchIndex;
              else return conversation;
            })
            .map((conversation: any) => (
              <TimelineBlock
                key={conversation.baseExpression}
                agent={agent}
                perspective={perspective}
                data={conversation}
                index={index + 1}
                match={match}
                selectedTopicId={selectedTopicId}
              />
            ))}
          {matchIndex < conversations.length - 1 && collapseAfter && (
            <div className={styles.expandButtonWrapper} style={{ marginTop: -20 }}>
              <div className={styles.expandButton}>
                <j-button onClick={() => setCollapseAfter(false)}>
                  See more
                  <span>
                    <ChevronDownSVG /> {conversations.length - matchIndex - 1}
                  </span>
                </j-button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginLeft: 130 }}>
          <j-flex gap="500" a="center">
            <j-text nomargin>Loading match...</j-text>
            <j-spinner size="xs" />
          </j-flex>
        </div>
      )}
    </div>
  );
}
