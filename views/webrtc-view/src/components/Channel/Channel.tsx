import { useAgent } from "@coasys/ad4m-react-hooks";
import { useWebRTC } from "@coasys/flux-react-web";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import useIntersectionObserver from "../../hooks/useIntersectionObserver";

import UiContext from "../../context/UiContext";
import Footer from "../Footer";
import JoinScreen from "../JoinScreen";
import Notifications from "../Notifications";
import Overlay from "../Overlay/Overlay";
import UserGrid from "../UserGrid";

import { Agent, PerspectiveProxy } from "@coasys/ad4m";
import { AgentClient } from "@coasys/ad4m/lib/src/agent/AgentClient";

// @ts-ignore
import { Profile } from "@coasys/flux-types";
import { profileFormatter } from "@coasys/flux-utils";
import Debug from "../Debug";
import Transcriber from "../Transcriber";
import styles from "./Channel.module.scss";

type Props = {
  source: string;
  perspective: PerspectiveProxy;
  agent: AgentClient;
  currentView: string;
  setModalOpen?: (state: boolean) => void;
};

export default function Channel({
  source,
  perspective,
  agent: agentClient,
  currentView,
  setModalOpen,
}: Props) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const wrapperEl = useRef<HTMLDivElement | null>(null);

  const { profile } = useAgent<Profile>({
    client: agentClient,
    did: () => agent?.did,
    formatter: (profile: any) => {
      return profileFormatter(profile?.perspective?.links || profile);
    },
  });
  const wrapperObserver = useIntersectionObserver(wrapperEl, {});
  const isPageActive = !!wrapperObserver?.isIntersecting;

  const {
    state: { showSettings, showDebug },
    methods: { addNotification, toggleShowSettings },
  } = useContext(UiContext);

  const webRTC = useWebRTC({
    enabled: isPageActive,
    source,
    agent: agentClient,
    perspective,
    events: {
      onPeerJoin: (userId) => {
        // TODO: Fix this
        // addNotification({ id: userId, userId, type: "join" });
      },
      onPeerLeave: (userId) => {
        // TODO: Fix this
        // addNotification({ id: userId, userId, type: "leave" });
      },
    },
  });

  // Get agent/me
  useEffect(() => {
    async function fetchAgent() {
      const agent = await agentClient.me();
      setAgent(agent);
    }

    if (!agent) {
      fetchAgent();
    }
  }, [agent]);

  return (
    <section
      className={`${styles.outer} ${currentView === "@coasys/flux-synergy-demo-view" && styles.synergy}`}
      ref={wrapperEl}
    >
      {!["@coasys/flux-webrtc-view", "@coasys/flux-synergy-demo-view"].includes(currentView) &&
        setModalOpen && (
          <button className={styles.closeButton} onClick={() => setModalOpen(false)}>
            <j-icon name="x" color="color-white" />
          </button>
        )}
      {!webRTC.hasJoined && (
        <JoinScreen
          webRTC={webRTC}
          profile={profile}
          did={agent?.did}
          onToggleSettings={() => toggleShowSettings(!showSettings)}
          currentView={currentView}
        />
      )}

      {webRTC.hasJoined && (
        <>
          <UserGrid webRTC={webRTC} agentClient={agentClient} profile={profile} />
          <Footer webRTC={webRTC} onToggleSettings={() => toggleShowSettings(!showSettings)} />
          {webRTC.localState.settings.transcriber.on && (
            <Transcriber webRTC={webRTC} source={source} perspective={perspective} />
          )}
        </>
      )}

      <Overlay webRTC={webRTC} profile={profile} />

      <>{showDebug && <Debug webRTC={webRTC} profile={profile} />}</>

      <Notifications />
    </section>
  );
}
