<template>
  <div class="community-sidebar" v-if="community">
    <button class="community-sidebar__header">
      <j-flex j="between" gap="300">
        <j-flex a="center" gap="400">
          <j-avatar
            style="--j-avatar-size: 35px"
            :src="require('@/assets/images/junto_app_icon.png')"
          />
          <div class="community-info">
            <j-text
              v-if="community.name"
              weight="500"
              color="ui-800"
              nomargin
              size="500"
            >
              {{ community.name }}
            </j-text>
            <j-text
              v-if="community.description"
              weight="300"
              color="ui-800"
              nomargin
              size="400"
            >
              {{ community.description }}
            </j-text>
          </div>
        </j-flex>
        <j-icon size="xs" name="chevron-expand"></j-icon>
      </j-flex>
    </button>

    <j-popover
      class="community-sidebar__header-menu"
      event="click"
      placement="bottom-start"
      selector=".community-sidebar__header"
    >
      <j-menu>
        <j-menu-item @click="() => setShowEditCommunity(true)">
          <j-icon size="xs" slot="start" name="pencil" />
          Edit community
        </j-menu-item>
        <j-menu-item @click="getInviteCode">
          <j-icon size="xs" slot="start" name="person-plus" />
          Invite people
        </j-menu-item>
        <j-divider />
        <j-menu-item @click="() => setShowCreateChannel(true)">
          <j-icon size="xs" slot="start" name="plus" />
          Create a new channel
        </j-menu-item>
      </j-menu>
    </j-popover>

    <j-box pt="500" px="500" pb="500">
      <avatar-group
        @click="() => setShowCommunityMembers(true)"
        :users="community.members"
      />
    </j-box>

    <j-box pt="500">
      <j-menu-group-item open title="Channels">
        <j-button
          @click.prevent="() => setShowCreateChannel(true)"
          size="sm"
          slot="end"
          variant="transparent"
        >
          <j-icon size="sm" square name="plus"></j-icon>
        </j-button>
        <router-link
          :to="{
            name: 'channel',
            params: {
              communityId: community.perspective,
              channelId: channel.perspective,
            },
          }"
          custom
          v-slot="{ navigate, isExactActive }"
          v-for="channel in community.channels"
          :key="channel.perspective"
        >
          <j-menu-item
            :id="getValidId(channel.perspective)"
            class="channel"
            :selected="isExactActive"
            @click="navigate"
          >
            <j-icon slot="start" size="sm" name="hash"></j-icon>
            {{ channel.name }}
            <div
              class="channel__notification"
              v-if="channel.hasNewMessages"
            ></div>
          </j-menu-item>
          <j-popover
            class="community-sidebar__header-menu"
            event="contextmenu"
            placement="bottom-start"
            :selector="'#' + getValidId(channel.perspective)"
          >
            <j-menu>
              <j-menu-item
                @click="
                  () =>
                    setChannelNotificationState({
                      communityId: community.perspective,
                      channelId: channel.perspective,
                    })
                "
              >
                <j-icon
                  size="xs"
                  slot="start"
                  :name="
                    channel?.notifications?.mute ? 'volume-mute' : 'volume-up'
                  "
                />
                {{
                  `${channel?.notifications?.mute ? "Unmute" : "Mute"} Channel`
                }}
              </j-menu-item>
            </j-menu>
          </j-popover>
        </router-link>
      </j-menu-group-item>
    </j-box>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import AvatarGroup from "@/components/avatar-group/AvatarGroup.vue";
import { mapMutations } from "vuex";

export default defineComponent({
  components: { AvatarGroup },
  props: ["community"],
  methods: {
    ...mapMutations([
      "setShowCreateChannel",
      "setShowEditCommunity",
      "setShowCommunityMembers",
      "setChannelNotificationState",
    ]),
    getValidId(val: string) {
      return "channel-" + val;
    },
    getInviteCode() {
      // Get the invite code to join community and copy to clipboard
      let currentCommunity = this.community;
      const el = document.createElement("textarea");
      el.value = `Hey! Here is an invite code to join my private community on Junto: ${currentCommunity.sharedPerspectiveUrl}`;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);

      this.$store.commit("showSuccessToast", {
        message: "Your custom invite code is copied to your clipboard!",
      });
    },
  },
});
</script>

<style lang="scss" scoped>
.community-sidebar__header {
  color: inherit;
  width: 100%;
  height: 74px;
  display: block;
  border: 0;
  outline: 0;
  font-family: inherit;
  text-align: left;
  background: none;
  cursor: pointer;
  padding: 0 var(--j-space-500);
  border-bottom: 1px solid var(--app-drawer-border-color);
}

.community-sidebar__header:hover {
  background: var(--j-color-ui-50);
}

.community-info {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

j-divider {
  display: block;
  width: 100%;
  border-bottom: 1px solid var(--j-color-ui-100);
  margin-top: var(--j-space-300);
  margin-bottom: var(--j-space-300);
}

.channel {
  position: relative;
  display: block;
}

.channel__notification {
  position: absolute;
  right: var(--j-space-300);
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--j-color-primary-500);
}
</style>
