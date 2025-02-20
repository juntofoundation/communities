<template>
  <div class="left-nav__communities-list">
    <j-tooltip
      v-for="(community, uuid) in communities"
      :key="uuid"
      :title="community.name || 'Unknown Community'"
    >
      <j-popover event="contextmenu">
        <Avatar
          slot="trigger"
          class="left-nav__community-item"
          :selected="communityIsActive(uuid as string)"
          :online="false"
          :src="community.image || undefined"
          :initials="`${community?.name}`.charAt(0).toUpperCase()"
          @click="() => handleCommunityClick(uuid as string)"
        ></Avatar>
        <j-menu slot="content">
          <j-menu-item
            @click="() => setShowLeaveCommunity(true, uuid as string)"
          >
            <j-icon slot="start" size="xs" name="box-arrow-left"></j-icon>
            Leave community
          </j-menu-item>

          <j-menu-item @click="() => muteCommunity(uuid as string)"
            ><j-icon size="xs" slot="start" name="bell" />
            Mute Community
          </j-menu-item>
          <j-menu-item @click="() => toggleHideMutedChannels(uuid as string)">
            <j-icon size="xs" slot="start" name="toggle-on" />
            Hide muted channels
          </j-menu-item>
        </j-menu>
      </j-popover>
    </j-tooltip>
    <j-tooltip title="Create or join community">
      <j-button
        @click="() => appStore.setShowCreateCommunity(true)"
        square
        circle
        variant="subtle"
      >
        <j-icon size="md" name="plus"></j-icon>
      </j-button>
    </j-tooltip>
  </div>
</template>

<script lang="ts">
import Avatar from "@/components/avatar/Avatar.vue";
import { useAppStore } from "@/store/app";
import { getAd4mClient } from "@coasys/ad4m-connect/utils";
import { usePerspectives } from "@coasys/ad4m-vue-hooks";
import { useCommunities } from "@coasys/flux-vue";
import { defineComponent, ref } from "vue";

export default defineComponent({
  components: {
    Avatar,
  },
  async setup() {
    const appStore = useAppStore();

    const client = await getAd4mClient();

    const { neighbourhoods } = usePerspectives(client);
    const { communities } = useCommunities(neighbourhoods);

    return {
      communities,
      showLeaveCommunity: ref(false),
      appStore,
    };
  },
  methods: {
    toggleHideMutedChannels(id: string) {
      /*
      this.dataStore.toggleHideMutedChannels({ communityId: id });
      */
    },
    muteCommunity(id: string) {
      /*
      this.dataStore.toggleCommunityMute({ communityId: id });
      */
    },
    setShowLeaveCommunity(show: boolean, uuid: string) {
      this.appStore.setActiveCommunity(uuid);
      this.appStore.setShowLeaveCommunity(show);
    },
    handleCommunityClick(communityId: string) {
      if (this.communityIsActive(communityId)) {
        this.appStore.toggleSidebar;
      } else {
        this.appStore.setSidebar(true);
        this.$router.push({ name: "community", params: { communityId } });
      }
    },
  },
  computed: {
    communityIsActive() {
      return (id: string) => this.$route.params.communityId === id;
    },
  },
});
</script>

<style lang="scss" scoped>
.left-nav__communities-list {
  padding-top: 4px;
  width: 100%;
  height: 100%;
  display: flex;
  gap: var(--j-space-400);
  flex-direction: column;
  align-items: center;
  overflow-y: scroll;
  overflow-x: visible;

  &::-webkit-scrollbar {
    display: none;
  }
}

.left-nav__community-item {
  cursor: pointer;
}
</style>
