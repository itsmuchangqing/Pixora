<script setup lang="ts">
/**
 * 品牌 Logo。纯展示组件：不接收业务数据，也没有交互。
 * 四个白色像素块组成标记，和“像素化”产品主题呼应。
 */
</script>

<template>
  <a class="brand" href="#top" aria-label="Pixora 像素工坊首页">
    <span class="brand-mark" aria-hidden="true">
      <span class="pixel pixel-1"></span>
      <span class="pixel pixel-2"></span>
      <span class="pixel pixel-3"></span>
      <span class="pixel pixel-4"></span>
    </span>
    <span class="brand-name">Pixora<span class="brand-dot">.</span></span>
  </a>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  border-radius: var(--radius-sm);
}

.brand-mark {
  display: grid;
  grid-template-columns: repeat(2, 6px);
  grid-auto-rows: 6px;
  place-content: center;
  gap: 2px;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--gradient-violet);
  box-shadow:
    0 6px 14px -6px rgba(109, 40, 217, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.pixel {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 1.5px;
  background: var(--white);
}

.pixel-1 {
  opacity: 1;
}

.pixel-2 {
  opacity: 0.74;
}

.pixel-3 {
  opacity: 0.58;
}

.pixel-4 {
  opacity: 0.92;
}

.brand-name {
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 720;
  letter-spacing: -0.035em;
}

.brand-dot {
  color: var(--violet-600);
}
</style>
