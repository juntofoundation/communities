<template>
  <j-box p="800">
    <j-flex direction="column" gap="500">
      <j-text variant="heading-sm">Edit Channel</j-text>

      <j-input
        size="lg"
        label="Name"
        :value="name"
        @keydown.enter="updateChannel"
        @input="(e) => (name = e.target.value)"
      ></j-input>

      <j-box pb="500" pt="300">
        <j-box pb="300">
          <j-text variant="label">Select at least one plugin</j-text>
          <j-text size="300" variant="label">
            Can't find a suitable plugin?
            <a
              target="_blank"
              style="color: var(--j-color-black)"
              href="https://docs.fluxsocial.io"
              >Create one</a
            >
          </j-text>
        </j-box>

        <j-box v-if="isLoading" align="center" p="500">
          <j-spinner></j-spinner>
        </j-box>

        <j-box v-else pb="500">
          <j-tabs
            class="tabs"
            :value="tab"
            @change="(e) => (tab = e.target.value)"
          >
            <j-tab-item value="official">Official</j-tab-item>
            <j-tab-item value="community">Community</j-tab-item>
          </j-tabs>
        </j-box>

        <j-flex v-if="!isLoading" direction="column" gap="500">
          <div class="app-card" v-for="app in filteredPackages" :key="app.name">
            <j-flex a="center" direction="row" j="between" gap="500">
              <j-flex gap="500" a="center" j="center">
                <j-icon size="lg" v-if="app.icon" :name="app.icon"></j-icon>
                <div>
                  <j-flex gap="300">
                    <j-text variant="heading-sm">
                      {{ app.name }}
                    </j-text>
                    <j-badge
                      size="sm"
                      v-if="app.pkg.startsWith('@coasys')"
                      variant="success"
                    >
                      Official App
                    </j-badge>
                  </j-flex>
                  <j-text nomargin>
                    {{ app.description }}
                  </j-text>
                </div>
              </j-flex>
              <div>
                <j-button
                  :variant="
                    isSelected(app.pkg) && loadedPlugins[app.pkg] === 'loaded'
                      ? ''
                      : 'primary'
                  "
                  :loading="loadedPlugins[app.pkg] === 'loading'"
                  @click="() => toggleView(app)"
                >
                  {{
                    isSelected(app.pkg) && loadedPlugins[app.pkg] === "loaded"
                      ? "Remove"
                      : "Add"
                  }}
                </j-button>
              </div>
            </j-flex>
          </div>
        </j-flex>
      </j-box>

      <j-box mt="500">
        <j-flex direction="row" j="end" gap="300">
          <j-button size="lg" variant="link" @click="() => $emit('cancel')">
            Cancel
          </j-button>
          <j-button
            :loading="isSaving"
            :disabled="!canSave || isSaving"
            @click="updateChannel"
            size="lg"
            variant="primary"
          >
            Save
          </j-button>
        </j-flex>
      </j-box>
    </j-flex>
  </j-box>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { useAppStore } from "@/store/app";
import {
  App,
  Channel,
  getAllFluxApps,
  FluxApp,
  generateWCName,
} from "@coasys/flux-api";
import ChannnelViewOptions from "@/components/channel-view-options/ChannelViewOptions.vue";
import { viewOptions } from "@/constants";
import { getAd4mClient } from "@coasys/ad4m-connect/utils";
import {
  useSubjects,
  useSubject,
  usePerspective,
} from "@coasys/ad4m-vue-hooks";
import { useRoute } from "vue-router";
import fetchFluxApp from "@/utils/fetchFluxApp";
import semver from "semver";
import { dependencies } from "../../package.json";

export default defineComponent({
  props: ["channelId"],
  emits: ["cancel", "submit"],
  components: { ChannnelViewOptions },
  async created() {
    this.isLoading = true;
    // Fetch apps from npm, use local apps if request fails
    try {
      const res = await getAllFluxApps();
      this.isLoading = false;
      const filtered = res.filter((pkg) => {
        try {
          return semver.gte(
            semver.coerce(pkg?.ad4mVersion || "0.0.0"),
            "0.8.1"
          );
        } catch (error) {
          return false;
        }
      });
      this.packages = filtered;
    } catch (error) {
      console.info("Flux is offline, using fallback apps");
      const offlineApps = await getOfflineFluxApps();
      this.packages = offlineApps;
      this.isLoading = false;
    }
  },
  async setup(props) {
    const route = useRoute();
    const client = await getAd4mClient();
    const { data } = usePerspective(client, () => route.params.communityId);

    const { entry: channel, repo } = useSubject({
      perspective: () => data.value.perspective,
      id: props.channelId,
      subject: Channel,
    });

    const { entries: apps, repo: appRepo } = useSubjects({
      perspective: () => data.value.perspective,
      source: () => props.channelId,
      subject: App,
    });

    return {
      repo,
      apps,
      appRepo,
      channel,
      tab: ref<"official" | "community">("official"),
      isLoading: ref(false),
      packages: ref<FluxApp[]>([]),
      loadedPlugins: ref<
        Record<string, "loaded" | "loading" | undefined | null>
      >({}),
      name: ref(""),
      description: ref(""),
      selectedPlugins: ref<App[]>([]),
      isSaving: ref(false),
      appStore: useAppStore(),
    };
  },
  computed: {
    canSave() {
      return this.selectedPlugins.length >= 1;
    },
    viewOptions() {
      return viewOptions;
    },
    officialApps(): FluxApp[] {
      return this.packages.filter((p) => p.pkg.startsWith("@coasys/"));
    },
    communityApps(): FluxApp[] {
      return this.packages.filter((p) => !p.pkg.startsWith("@coasys/"));
    },
    filteredPackages(): FluxApp[] {
      return this.tab === "official" ? this.officialApps : this.communityApps;
    },
  },
  watch: {
    apps: {
      handler: async function (apps) {
        if (apps) {
          this.selectedPlugins = apps;
        }
      },
      deep: true,
      immediate: true,
    },
    channel: {
      handler: async function (channel) {
        if (channel) {
          this.name = channel.name;
          this.description = channel.description;
        }
      },
      deep: true,
      immediate: true,
    },
    selectedPlugins: {
      handler: async function (apps: FluxApp[]) {
        apps?.forEach(async (app) => {
          const wcName = await generateWCName(app.pkg);
          if (customElements.get(wcName)) {
            this.loadedPlugins[app.pkg] = "loaded";
          } else {
            this.loadedPlugins[app.pkg] = "loading";

            const module = await fetchFluxApp(app.pkg);
            if (module) {
              customElements.define(wcName, module.default);
            }

            this.loadedPlugins[app.pkg] = "loaded";
            this.$forceUpdate();
          }
        });
      },
      deep: true,
      immediate: true,
    },
  },
  methods: {
    toggleView(app: App) {
      console.log("toggleView");
      const isSelected = this.selectedPlugins.some((a) => a.pkg === app.pkg);

      this.selectedPlugins = isSelected
        ? this.selectedPlugins.filter((a) => a.pkg !== app.pkg)
        : [...this.selectedPlugins, app];

      // Preload view when selected to remove loading on submit
      if (!isSelected) {
        fetchFluxApp(app.pkg);
      }
    },
    isSelected(pkg: any) {
      return this.selectedPlugins.some((app) => app.pkg === pkg);
    },
    async updateChannel() {
      this.isSaving = true;

      try {
        console.log("selected views", this.selectedPlugins, this.apps);

        const removeApps = this.apps
          .filter((app) => !this.selectedPlugins.some((a) => a.pkg === app.pkg))
          .map((app) => {
            return this.appRepo?.remove(app.id);
          });

        await Promise.all(removeApps);

        const addedApps = this.selectedPlugins
          .filter((app) => !this.apps.some((a) => a.pkg === app.pkg))
          .map((app) => {
            return this.appRepo?.create(
              {
                name: app.name,
                description: app.description,
                icon: app.icon,
                pkg: app.pkg,
              },
              app.pkg
            );
          });

        await Promise.all(addedApps);

        await this.repo?.update(this.$route.params.channelId as string, {
          name: this.name,
        });

        this.$emit("submit");
      } finally {
        this.isSaving = false;
      }
    },
  },
});
</script>

<style scoped>
.app-card {
  padding: var(--j-space-500);
  border-radius: var(--j-border-radius);
  background: var(--j-color-ui-50);
  border: 1px solid var(--j-color-ui-100);
}

j-tabs::part(base) {
  gap: var(--j-space-500);
}

j-tab-item::part(base) {
  padding: 0;
}
</style>
