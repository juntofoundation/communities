<template>
  <div>
    <j-box pb="800">
      <j-box pb="500">
        <j-text variant="heading-sm">Appeareance</j-text>
      </j-box>
      <j-box pb="800">
        <j-box pb="300">
          <j-text variant="label">Primary color</j-text>
        </j-box>
        <div class="colors">
          <button
            v-for="n in [0, 20, 50, 100, 150, 200, 220, 241, 270, 300, 340]"
            :key="n"
            class="color-button"
            @click="() => updateTheme({ hue: n })"
            :style="`--hue: ${n}`"
          >
            <j-icon
              style="color: var(--j-color-white)"
              v-if="theme.hue === n"
              name="check"
            />
          </button>
        </div>
      </j-box>
      <j-box pb="300">
        <j-text variant="label">Theme</j-text>
      </j-box>
      <j-tabs
        variant="button"
        wrap
        :value="theme.name"
        @change="(e: any) => updateTheme({ name: e.target.value })"
      >
        <j-tab-item value="light">Light</j-tab-item>
        <j-tab-item value="dark">Dark</j-tab-item>
        <j-tab-item value="gradient">Gradient</j-tab-item>
        <j-tab-item value="black">Black</j-tab-item>
        <j-tab-item value="cyberpunk">Cyberpunk</j-tab-item>
        <j-tab-item value="retro">Retro</j-tab-item>
      </j-tabs>
    </j-box>
    <j-box pb="800">
      <j-box pb="300">
        <j-text variant="label">Font family</j-text>
      </j-box>
      <j-tabs
        variant="button"
        wrap
        :value="theme.fontFamily"
        @change="(e: any) => updateTheme({ fontFamily: e.target.value })"
      >
        <j-tab-item value="DM Sans">DM Sans</j-tab-item>
        <j-tab-item value="Poppins">Poppins</j-tab-item>
        <j-tab-item value="Roboto">Roboto</j-tab-item>
        <j-tab-item value="Inter">Inter</j-tab-item>
        <j-tab-item value="Fira Code">Fira Code</j-tab-item>
        <j-tab-item value="IBM Plex Mono"> IBM Plex Mono </j-tab-item>
        <j-tab-item value="IBM Plex Sans"> IBM Plex Sans </j-tab-item>
        <j-tab-item value="Rubik"> Rubik </j-tab-item>
        <j-tab-item value="Space Grotesk"> Space Grotesk </j-tab-item>
      </j-tabs>
    </j-box>
    <j-box pb="800">
      <j-box pb="300">
        <j-text variant="label">Saturation</j-text>
      </j-box>
      <j-tabs
        variant="button"
        wrap
        :value="theme.saturation.toString()"
        @change="(e: any) => updateTheme({ saturation: e.target.value })"
      >
        <j-tab-item value="30">Weak</j-tab-item>
        <j-tab-item value="60">Normal</j-tab-item>
        <j-tab-item value="100">Vibrant</j-tab-item>
      </j-tabs>
    </j-box>
    <j-box pb="800">
      <j-box pb="300">
        <j-text variant="label">Font size</j-text>
      </j-box>
      <j-tabs
        variant="button"
        wrap
        :value="theme.fontSize.replace('px', '')"
        @change="(e: any) => updateTheme({ fontSize: e.target.value + 'px' })"
      >
        <j-tab-item value="15">Small</j-tab-item>
        <j-tab-item value="16">Medium</j-tab-item>
        <j-tab-item value="17">Large</j-tab-item>
      </j-tabs>
    </j-box>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  emits: ["update"],
  props: ["theme"],
  methods: {
    updateTheme(val: any) {
      if (this.theme) {
        this.$emit("update", val);
      }
    },
  },
});
</script>

<style scoped>
.color-button {
  --hue: 0;
  --saturation: 80%;
  width: var(--j-size-md);
  height: var(--j-size-md);
  background-color: hsl(var(--hue), var(--saturation), 60%);
  border: 2px solid transparent;
  outline: 0;
  border-radius: var(--j-border-radius);
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--j-space-200);
  max-width: 400px;
}

input[type="range"] {
  -webkit-appearance: none;
  margin: 0;
  width: 100%;
  background: none;
}

input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: calc(var(--j-size-sm) / 2);
  background-color: var(--j-color-ui-100);
  border: none;
  border-radius: 3px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  border: none;
  transition: all 0.5s ease;
  height: var(--j-size-sm);
  width: calc(var(--j-size-sm) / 2);
  border-radius: var(--j-border-radius);
  background: var(--j-color-primary-300);
  margin-top: calc(var(--j-size-sm) / -4);
}
</style>
