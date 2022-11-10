import addChannelView from "utils/api/addChannelView";
import { useAppStore } from "@/store/app";
import { useDataStore } from "..";

export interface Payload {
  perspectiveUuid: string;
  channelId: string;
  view: string;
}

export default async (payload: Payload): Promise<any> => {
  const dataStore = useDataStore();
  const appStore = useAppStore();

  const channel = dataStore.channels[payload.channelId];

  if (!channel) {
    appStore.showDangerToast({
      message: "Couldn't find a channel to add the view to",
    });
  }

  if (channel.views.includes(payload.view)) {
    appStore.showDangerToast({
      message: "This view is already installed",
    });
    return;
  }

  try {
    await addChannelView({
      perspectiveUuid: payload.perspectiveUuid,
      channelId: channel.id,
      view: payload.view,
    });
    dataStore.putChannelView({
      channelId: channel.id,
      view: payload.view,
    });
  } catch (e) {
    appStore.showDangerToast({
      message: e.message,
    });
    throw new Error(e);
  }
};
