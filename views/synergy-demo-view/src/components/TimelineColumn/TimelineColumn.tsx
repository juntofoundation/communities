import { useEffect, useState, useRef } from "preact/hooks";
import { closeMenu, getConversationData, groupingOptions, findItemState } from "../../utils";
import { processItem } from "@coasys/flux-utils";
import TimelineBlock from "../TimelineBlock";
import styles from "./TimelineColumn.module.scss";
import { getAd4mClient } from "@coasys/ad4m-connect/utils";

type Props = {
  agent: any;
  perspective: any;
  channelId: string;
  selectedTopicId: string;
  search: (type: "topic" | "vector", id: string) => void;
};

export default function TimelineColumn({
  agent,
  perspective,
  channelId,
  selectedTopicId,
  search,
}: Props) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [processingItems, setProcessingItems] = useState<any[]>([]);
  const [unprocessedItems, setUnprocessedItems] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<any>(null);
  const [zoom, setZoom] = useState(groupingOptions[0]);
  const [usingLLM, setUsingLLM] = useState(false);
  const timeout = useRef<any>(null);

  async function getData() {
    const data = await getConversationData(perspective, channelId);
    setProcessingItems(data.processingItems);
    setUnprocessedItems(data.unprocessedItems);
    setConversations(data.conversations);
  }

  async function processItems() {
    setProcessing(true);
    for (const item of unprocessedItems) {
      // check if item still needs processing first incase someone has started
      const state = await findItemState(perspective, item.baseExpression);
      if (state !== "unprocessed") continue;
      await processItem(perspective, channelId, item, true);
    }
    setProcessing(false);
  }

  async function checkIfUsingLLM() {
    const client = await getAd4mClient();
    const defaultLLM = await client.ai.getDefaultModel("LLM");
    setUsingLLM(!!defaultLLM);
  }

  function linkAddedListener() {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(getData, 1000);
  }

  useEffect(() => {
    perspective.addListener("link-added", linkAddedListener);
    checkIfUsingLLM();
    getData();

    return () => perspective.removeListener("link-added", linkAddedListener);
  }, []);

  return (
    <div className={styles.wrapper}>
      <j-flex a="center" j="between" className={styles.header}>
        <j-flex a="center" gap="400">
          <j-text nomargin>Zoom</j-text>
          <j-menu style={{ height: 42, zIndex: 3 }}>
            <j-menu-group collapsible title={zoom} id="zoom-menu">
              {groupingOptions.map((option) => (
                <j-menu-item
                  selected={zoom === option}
                  onClick={() => {
                    setZoom(option);
                    closeMenu("zoom-menu");
                  }}
                >
                  {option}
                </j-menu-item>
              ))}
            </j-menu-group>
          </j-menu>
        </j-flex>
        {(processingItems.length > 0 || unprocessedItems.length > 0) && (
          <j-flex a="center" gap="400">
            {processingItems.length > 0 && (
              <j-badge variant="success">
                {processingItems.length} item
                {processingItems.length > 1 ? "s" : ""} processing...
              </j-badge>
            )}
            {unprocessedItems.length > 0 && (
              <>
                <j-badge variant="warning">
                  {unprocessedItems.length} unprocessed item
                  {unprocessedItems.length > 1 ? "s" : ""}
                </j-badge>
                {usingLLM && (
                  <j-button
                    size="sm"
                    onClick={processItems}
                    loading={processing}
                    disabled={processing}
                  >
                    Process
                  </j-button>
                )}
              </>
            )}
          </j-flex>
        )}
      </j-flex>
      <div className={styles.timeline}>
        <div className={styles.fades}>
          <div className={styles.fadeTop} />
          <div className={styles.fadeBottom} />
          <div className={styles.line} />
        </div>
        <div id="timeline-0" className={styles.items}>
          {conversations.map((conversation: any) => (
            <TimelineBlock
              agent={agent}
              perspective={perspective}
              data={conversation}
              index={0}
              zoom={zoom}
              selectedTopicId={selectedTopicId}
              selectedItemId={selectedItemId}
              setSelectedItemId={setSelectedItemId}
              search={search}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
