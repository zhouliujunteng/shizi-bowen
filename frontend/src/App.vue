<template>
  <router-view />
</template>

<style>
:root {
  --bw-primary: #4f46e5;
  --bw-bg: #f6f7fb;
  --bw-ink: #1f2333;
  --bw-muted: #8a8fa3;
  --bw-border: #e4e7f0;
}
* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
body {
  font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
  color: var(--bw-ink);
  background: var(--bw-bg);
}
/* Element Plus 主色对齐设计系统 */
.el-button--primary {
  --el-button-bg-color: var(--bw-primary);
  --el-button-border-color: var(--bw-primary);
  --el-button-hover-bg-color: #6366f1;
  --el-button-hover-border-color: #6366f1;
}
</style>
