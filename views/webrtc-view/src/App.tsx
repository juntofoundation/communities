import { PerspectiveProxy } from "@coasys/ad4m";
import { AgentClient } from "@coasys/ad4m/lib/src/agent/AgentClient";
import Channel from "./components/Channel";
import { UiProvider } from "./context/UiContext";

type Props = {
  source: string;
  perspective: PerspectiveProxy;
  agent: AgentClient;
  currentView: string;
  setModalOpen?: (state: boolean) => void;
};

export default function App({ perspective, source, agent, currentView, setModalOpen }: Props) {
  if (!perspective?.uuid || !source) {
    return null;
  }

  return (
    <UiProvider>
      <Channel
        source={source}
        agent={agent}
        perspective={perspective}
        currentView={currentView}
        setModalOpen={setModalOpen}
      />
    </UiProvider>
  );
}
