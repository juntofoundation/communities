import { useEffect, useState } from "preact/hooks";
import { ChevronDownSVG, ChevronRightSVG, ChevronUpSVG, CurveSVG } from "../../utils";
import Avatar from "../Avatar";
import PercentageRing from "../PercentageRing";
import styles from "./TimelineBlock.module.scss";

type Props = {
  agent: any;
  perspective: any;
  data: any;
  index: number;
  selectedTopicId: string;
  match?: any;
  zoom?: string;
  selectedItemId?: string;
  setSelectedItemId?: (id: string) => void;
  search?: (type: "topic" | "vector", id: string) => void;
};

export default function TimelineBlock({
  agent,
  perspective,
  data,
  index,
  zoom,
  match,
  selectedTopicId,
  selectedItemId,
  setSelectedItemId,
  search,
}: Props) {
  const {
    baseExpression,
    state,
    groupType,
    timestamp,
    start,
    end,
    author,
    participants,
    topics,
    children,
  } = data;
  const [showChildren, setShowChildren] = useState(data.matchIndex !== undefined);
  const [selected, setSelected] = useState(false);
  const [collapseBefore, setCollapseBefore] = useState(true);
  const [collapseAfter, setCollapseAfter] = useState(true);

  // mark as selected
  useEffect(() => {
    setSelected(
      selectedItemId === baseExpression || (match && match.baseExpression === baseExpression)
    );
  }, [selectedItemId]);

  // expand or collapse children based on zoom level
  useEffect(() => {
    if (zoom) {
      if (zoom === "Conversations") setShowChildren(false);
      else if (zoom === "Subgroups") setShowChildren(groupType === "conversation");
      else if (groupType !== "item") setShowChildren(true);
    }
  }, [zoom]);

  // scroll to matching item
  useEffect(() => {
    if (selectedItemId) {
      const item = document.getElementById(`timeline-block-${selectedItemId}`);
      const timeline = document.getElementById(`timeline-${index}`);
      timeline.scrollBy({
        top: item?.getBoundingClientRect().top - 550,
        behavior: "smooth",
      });
    }
  }, [selectedItemId]);

  return (
    <div id={`timeline-block-${baseExpression}`} className={`${styles.block} ${styles[groupType]}`}>
      {!match && (
        <button
          className={styles.button}
          onClick={() => setSelectedItemId(selected ? null : baseExpression)}
        />
      )}
      {groupType === "conversation" && (
        <j-timestamp value={timestamp} relative className={styles.timestamp} />
      )}
      {groupType === "subgroup" && (
        <span className={styles.timestamp}>
          {((new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60).toFixed(1)} mins
        </span>
      )}
      {groupType === "item" && (
        <j-timestamp value={timestamp} timeStyle="short" className={styles.timestamp} />
      )}
      <div className={styles.position}>
        {!showChildren && <div className={`${styles.node} ${selected && styles.selected}`} />}
        <div className={`${styles.line} ${showChildren && styles.showChildren}`} />
      </div>
      {["conversation", "subgroup"].includes(groupType) && (
        <j-flex direction="column" gap="300" className={styles.content}>
          <j-flex
            direction="column"
            gap="300"
            className={`${styles.card} ${selected && styles.selected}`}
          >
            <j-flex a="center" gap="400">
              <j-flex a="center" gap="400">
                {match && match.baseExpression === baseExpression && (
                  <PercentageRing ringSize={70} fontSize={10} score={match.score * 100} />
                )}
                <h1>{data[`${groupType}Name`]}</h1>
              </j-flex>
              {children.length > 0 && (
                <button
                  className={styles.showChildrenButton}
                  onClick={() => {
                    if (!match && selectedItemId !== baseExpression) setSelectedItemId(null);
                    setShowChildren(!showChildren);
                  }}
                >
                  {showChildren ? <ChevronDownSVG /> : <ChevronRightSVG />}
                  {children.length}
                </button>
              )}
            </j-flex>
            <p className={styles.summary}>{data.summary}</p>
            <j-flex className={styles.participants}>
              {participants.map((p, i) => (
                <Avatar did={p} style={{ marginLeft: i > 0 ? -10 : 0 }} />
              ))}
            </j-flex>
            {selected && (
              <j-flex gap="300" wrap style={{ marginTop: 5 }}>
                {data.topics.map((topic) => (
                  <button
                    className={`${styles.tag} ${selectedTopicId === topic.baseExpression && styles.focus}`}
                    onClick={() => search("topic", topic)}
                    disabled={!!match}
                    style={{ cursor: !!match ? "default" : "pointer" }}
                  >
                    #{topic.name}
                  </button>
                ))}
                {!match && (
                  <button
                    className={`${styles.tag} ${styles.vector}`}
                    onClick={() => search("vector", data)}
                  >
                    <j-icon
                      name="flower2"
                      color="color-success-500"
                      size="sm"
                      style={{ marginRight: 5 }}
                    />
                    Synergize
                  </button>
                )}
              </j-flex>
            )}
          </j-flex>
          {children.length > 0 && showChildren && (
            <div className={styles.children}>
              {data.matchIndex > 0 && collapseBefore && (
                <>
                  <div className={styles.expandButtonWrapper} style={{ marginTop: 6 }}>
                    <div className={styles.expandButton}>
                      <j-button onClick={() => setCollapseBefore(false)}>
                        See more
                        <span>
                          <ChevronUpSVG /> {data.matchIndex}
                        </span>
                      </j-button>
                    </div>
                  </div>
                  <div className={styles.expandButtonPadding} />
                </>
              )}
              <div className={styles.curveTop}>
                <CurveSVG />
              </div>
              {children
                .filter((child: any, i) => {
                  if (match && data.matchIndex !== undefined) {
                    if (collapseBefore && collapseAfter) return i === data.matchIndex;
                    else if (collapseBefore) return i >= data.matchIndex;
                    else if (collapseAfter) return i <= data.matchIndex;
                  }
                  return child;
                })
                .map((child) => (
                  <TimelineBlock
                    key={child.baseExpression}
                    agent={agent}
                    perspective={perspective}
                    data={child}
                    index={index}
                    match={match}
                    zoom={zoom}
                    selectedTopicId={selectedTopicId}
                    selectedItemId={selectedItemId}
                    setSelectedItemId={setSelectedItemId}
                    search={search}
                  />
                ))}
              <div className={styles.curveBottom}>
                <CurveSVG />
              </div>
              {data.matchIndex < data.children.length - 1 && collapseAfter && (
                <div
                  className={styles.expandButtonWrapper}
                  style={{ marginTop: groupType === "subgroup" ? -8 : -20 }}
                >
                  <div className={styles.expandButton}>
                    <j-button onClick={() => setCollapseAfter(false)}>
                      See more
                      <span>
                        <ChevronDownSVG /> {data.children.length - data.matchIndex - 1}
                      </span>
                    </j-button>
                  </div>
                </div>
              )}
            </div>
          )}
        </j-flex>
      )}
      {groupType === "item" && (
        <j-flex
          gap="400"
          a="center"
          className={`${styles.itemCard} ${selected && styles.selected}`}
        >
          {match && match.baseExpression === baseExpression && (
            <PercentageRing ringSize={70} fontSize={10} score={match.score * 100} />
          )}
          <j-flex gap="300" direction="column">
            <j-flex gap="400" a="center">
              <j-icon name={data.icon} color="ui-400" size="lg" />
              <j-flex gap="400" a="center" wrap>
                <Avatar did={author} showName />
              </j-flex>
              {state === "unprocessed" && <j-badge variant="warning">Unprocessed</j-badge>}
              {!["processed", "unprocessed"].includes(state) && (
                <j-badge variant="success">Processing...</j-badge>
              )}
            </j-flex>
            <j-text
              nomargin
              dangerouslySetInnerHTML={{ __html: data.text }}
              className={styles.itemText}
              color="color-white"
            />
            {selected && state === "processed" && (
              <j-flex gap="300" wrap style={{ marginTop: 10 }}>
                {topics.map((topic) => (
                  <button
                    className={`${styles.tag} ${selected && selectedTopicId === topic.baseExpression && styles.focus}`}
                    onClick={() => search("topic", topic)}
                    disabled={!!match}
                    style={{ cursor: !!match ? "default" : "pointer" }}
                  >
                    #{topic.name}
                  </button>
                ))}
                {!match && (
                  <button
                    className={`${styles.tag} ${styles.vector}`}
                    onClick={() => search("vector", data)}
                  >
                    <j-icon
                      name="flower2"
                      color="color-success-500"
                      size="sm"
                      style={{ marginRight: 5 }}
                    />
                    Synergize
                  </button>
                )}
              </j-flex>
            )}
          </j-flex>
        </j-flex>
      )}
    </div>
  );
}
