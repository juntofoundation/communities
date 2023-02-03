import { useContext } from "preact/hooks";
import WebRTCContext from "../../context/WebRTCContext";

import styles from "./Footer.module.css";

export default function Footer({
  localStream,
  currentUser,
  onToggleCamera,
  onLeave,
}) {
  const cameraEnabled = currentUser && currentUser.prefrences.video;

  return (
    <div className={styles.wrapper}>
      <div className={styles.inner}>
        <j-button
          variant="primary"
          onClick={onToggleCamera}
          disabled={!localStream}
        >
          {cameraEnabled ? "Disable camera" : "Enable camera"}
        </j-button>
        <j-button variant="secondary" onClick={onLeave} disabled={!localStream}>
          Leave
        </j-button>
      </div>
    </div>
  );
}
