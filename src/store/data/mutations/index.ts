import {
  ExpressionAndRef,
  LinkExpressionAndLang,
  State,
  CommunityState,
  AddChannel,
  ThemeState,
} from "@/store/types";

import { parseExprUrl } from "@perspect3vism/ad4m-types";
import type { Expression, LinkExpression } from "@perspect3vism/ad4m-types";
import hash from "object-hash";

interface UpdatePayload {
  communityId: string;
  name: string;
  description: string;
  groupExpressionRef: string;
}

interface AddChannelMessages {
  channelId: string;
  communityId: string;
  links: { [x: string]: LinkExpressionAndLang };
  expressions: { [x: string]: ExpressionAndRef };
}

interface AddChannelMessage {
  channelId: string;
  link: LinkExpression;
  expression: Expression;
}

export default {
  addCommunity(state: State, payload: CommunityState): void {
    console.log("adding Community", payload);
    state.data.neighbourhoods[payload.neighbourhood.perspective.uuid] =
      payload.neighbourhood;
    state.data.communities[payload.neighbourhood.perspective.uuid] =
      payload.state;
  },

  addMessages(state: State, payload: AddChannelMessages): void {
    const neighbourhood = state.data.neighbourhoods[payload.channelId];
    console.log(
      "Adding ",
      Object.values(payload.links).length,
      " to channel and ",
      Object.values(payload.expressions).length,
      " to channel"
    );
    neighbourhood.currentExpressionLinks = {
      ...neighbourhood.currentExpressionLinks,
      ...payload.links,
    };
    neighbourhood.currentExpressionMessages = {
      ...neighbourhood.currentExpressionMessages,
      ...payload.expressions,
    };
  },

  addMessage(state: State, payload: AddChannelMessage): void {
    const neighbourhood = state.data.neighbourhoods[payload.channelId];

    neighbourhood.currentExpressionLinks[
      hash(payload.link.data!, { excludeValues: "__typename" })
    ] = payload.link;
    neighbourhood.currentExpressionMessages[payload.expression.url!] = {
      expression: {
        author: payload.expression.author!,
        data: JSON.parse(payload.expression.data!),
        timestamp: payload.expression.timestamp!,
        proof: payload.expression.proof!,
      } as Expression,
      url: parseExprUrl(payload.link.data!.target!),
    };
  },

  setCurrentChannelId(
    state: State,
    payload: { communityId: string; channelId: string }
  ): void {
    const { communityId, channelId } = payload;
    state.data.communities[communityId].currentChannelId = channelId;
  },

  removeCommunity(state: State, id: string): void {
    delete state.data.communities[id];
    delete state.data.neighbourhoods[id];
  },

  setChannelNotificationState(
    state: State,
    { communityId, channelId }: { communityId: string; channelId: string }
  ): void {
    const channel = state.data.communities[communityId].channels[channelId];

    channel.notifications.mute = !channel.notifications.mute;
  },

  setCommunityMembers(
    state: State,
    { members, communityId }: { members: Expression[]; communityId: string }
  ): void {
    const community = state.data.neighbourhoods[communityId];

    if (community) {
      community.members = members;
    }
  },

  setCommunityTheme(
    state: State,
    payload: { communityId: string; theme: ThemeState }
  ): void {
    state.data.communities[payload.communityId].theme = {
      ...state.data.communities[payload.communityId].theme,
      ...payload.theme,
    };
  },

  updateCommunityMetadata(
    state: State,
    { communityId, name, description, groupExpressionRef }: UpdatePayload
  ): void {
    const community = state.data.neighbourhoods[communityId];

    if (community) {
      community.name = name;
      community.description = description;
      community.groupExpressionRef = groupExpressionRef;
    }

    state.data.neighbourhoods[communityId] = community;
  },

  setChannelScrollTop(
    state: State,
    payload: { channelId: string; communityId: string; value: number }
  ): void {
    state.data.communities[payload.communityId].channels[
      payload.channelId
    ].scrollTop = payload.value;
  },

  addChannel(state: State, payload: AddChannel): void {
    const neighbourhood = state.data.neighbourhoods[payload.communityId];
    const community = state.data.communities[payload.communityId];

    if (neighbourhood !== undefined) {
      neighbourhood.linkedNeighbourhoods.push(
        payload.channel.neighbourhood.perspective.uuid
      );
      community.channels[payload.channel.neighbourhood.perspective.uuid] = {
        ...payload.channel.state,
        hasNewMessages: false,
      };
    }
  },

  setHasNewMessages(
    state: State,
    payload: { channelId: string; value: boolean }
  ): void {
    for (const community of Object.values(state.data.communities)) {
      for (const channel of Object.values(community.channels)) {
        if (channel.perspectiveUuid === payload.channelId) {
          channel.hasNewMessages = payload.value;
        }
      }
    }
  },

  addExpressionAndLink: (
    state: State,
    payload: {
      channelId: string;
      link: LinkExpression;
      message: Expression;
    }
  ): void => {
    const channel = state.data.neighbourhoods[payload.channelId];
    console.log("Adding to link and exp to channel!", payload.message);
    channel.currentExpressionLinks[
      hash(payload.link.data!, { excludeValues: "__typename" })
    ] = {
      expression: payload.link,
      language: "na",
    } as LinkExpressionAndLang;
    //TODO: make gql expression to ad4m expression conversion function
    channel.currentExpressionMessages[payload.message.url!] = {
      expression: {
        author: payload.message.author!,
        data: JSON.parse(payload.message.data!),
        timestamp: payload.message.timestamp!,
        proof: payload.message.proof!,
      } as Expression,
      url: parseExprUrl(payload.link.data!.target!),
    } as ExpressionAndRef;
  },
};
