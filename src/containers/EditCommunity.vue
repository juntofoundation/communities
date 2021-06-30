<template>
  <j-text variant="heading">Edit Community</j-text>
  <j-flex direction="column" gap="400">
    <j-input
      size="lg"
      label="Name"
      :value="communityName"
      @keydown.enter="updateCommunity"
      @input="(e) => (communityName = e.target.value)"
    ></j-input>
    <j-input
      size="lg"
      label="Description"
      :value="communityDescription"
      @keydown.enter="updateCommunity"
      @input="(e) => (communityDescription = e.target.value)"
    ></j-input>
    <div>
      <j-button variant="link" size="lg" @click="$emit('cancel')">
        Cancel
      </j-button>
      <j-button
        size="lg"
        :loading="isUpdatingCommunity"
        :disabled="isUpdatingCommunity"
        @click="updateCommunity"
        variant="primary"
      >
        Save
      </j-button>
    </div>
  </j-flex>
</template>

<script lang="ts">
import { CommunityState } from "@/store";
import { defineComponent } from "vue";

export default defineComponent({
  emits: ["cancel", "submit"],
  data() {
    return {
      isUpdatingCommunity: false,
      communityName: "",
      communityDescription: "",
    };
  },
  watch: {
    community: {
      handler: function ({ name, description }) {
        this.communityName = name;
        this.communityDescription = description;
      },
      deep: true,
      immediate: true,
    },
  },
  computed: {
    community(): CommunityState {
      return this.$store.getters.getCommunity(this.$route.params.communityId);
    },
  },
  methods: {
    async updateCommunity() {
      const { communityId } = this.$route.params;
      this.isUpdatingCommunity = true;
      this.$store
        .dispatch("updateCommunity", {
          communityId: communityId,
          name: this.communityName,
          description: this.communityDescription,
        })
        .then(() => {
          this.$emit("submit");
        })
        .finally(() => {
          this.isUpdatingCommunity = false;
        });
    },
  },
});
</script>
