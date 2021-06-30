<template>
  <j-flex direction="column" gap="700">
    <div>
      <j-text variant="heading">Create Channel</j-text>
      <j-text variant="body">
        Channels are ways to organize your conversations by topics.
      </j-text>
    </div>
    <j-flex direction="column" gap="400">
      <j-input
        size="lg"
        label="Name"
        :value="channelName"
        @keydown.enter="createChannel"
        @input="(e) => (channelName = e.target.value)"
      ></j-input>
      <div>
        <j-button size="lg" variant="link" @click="$emit('cancel')">
          Cancel
        </j-button>
        <j-button
          size="lg"
          :loading="isCreatingChannel"
          :disabled="isCreatingChannel"
          @click="createChannel"
          variant="primary"
        >
          Create Channel
        </j-button>
      </div>
    </j-flex>
  </j-flex>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  emits: ["cancel", "submit"],
  data() {
    return {
      channelName: "",
      isCreatingChannel: false,
    };
  },
  methods: {
    async createChannel() {
      const { communityId } = this.$route.params;
      const name = this.channelName;
      this.isCreatingChannel = true;
      this.$store
        .dispatch("createChannel", {
          communityId,
          name,
        })
        .then(() => {
          this.$emit("submit");
          this.channelName = "";
        })
        .finally(() => {
          this.isCreatingChannel = false;
        });
    },
  },
});
</script>
