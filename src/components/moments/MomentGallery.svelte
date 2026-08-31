<script lang="ts">
    /**
     * 动态图片画廊：两段式看图。
     * 网格态：按数量自适应（1 单图直进灯箱 / 2 与 4 双列方格 / 3 拼 1大+2小 /
     * 5+ 三列封顶 6 块 +N 折叠，桌面端限宽防格子过大）。
     * 查看器态：卡片内展开主舞台 + 前后切换 + 计数 chip + 缩略图条
     * （active 高亮并自动居中），点大图或「查看原图」经 Fancybox API 进灯箱轮播。
     * 键盘：←/→ 切换、Home/End 首尾、Esc 收起；开合带焦点管理与入场动效。
     */
    import { openFancyboxGallery } from "@utils/fancybox";
    import { tick } from "svelte";

    export type MomentGalleryImage = { src: string; alt?: string };

    let { images = [] }: { images?: MomentGalleryImage[] } = $props();

    const MAX_TILES = 6;

    let viewing = $state(false);
    let index = $state(0);
    let viewerEl: HTMLElement | undefined = $state();
    let gridEl: HTMLElement | undefined = $state();
    let thumbEls: HTMLButtonElement[] = [];
    /** 收起后焦点返回被点击的瓦片（记索引：开查看器时网格已卸载） */
    let lastIndex = 0;

    /** 图片加载失败标记（按 src 去重，瓦片/主图/缩略图共享） */
    let failedImages = $state(new Set<string>());
    /** 瓦片图片加载进度：lazy 触发 loadstart 后才挂载指示器（离屏瓦片不空转） */
    let startedTiles = $state(new Set<string>());
    let loadedTiles = $state(new Set<string>());
    let loadedViewerImages = $state(new Set<string>());

    const current = $derived(images[index] ?? images[0]);
    const visibleImages = $derived(
        images.length > MAX_TILES ? images.slice(0, MAX_TILES) : images,
    );
    const remainder = $derived(
        images.length > MAX_TILES ? images.length - MAX_TILES : 0,
    );
    const gridVariant = $derived.by(() => {
        if (images.length === 1) return "single";
        /* 3 图走「1 大 + 2 小」拼图，避免双列网格的 2+1 孤儿行 */
        if (images.length === 3) return "mosaic";
        if (images.length <= 4) return "pair";
        return "trio";
    });

    function openViewer(i: number) {
        lastIndex = i;
        index = i;
        thumbEls = [];
        viewing = true;
    }

    async function collapseViewer() {
        viewing = false;
        // 等网格重新挂载后，把焦点还给当初点击的瓦片
        await tick();
        (gridEl?.children[lastIndex] as HTMLButtonElement | undefined)?.focus({
            preventScroll: true,
        });
    }

    function openLightbox(i: number) {
        void openFancyboxGallery(
            images.map((image) => ({
                src: image.src,
                caption: image.alt || undefined,
            })),
            i,
        );
    }

    function go(delta: number) {
        const next = index + delta;
        if (next >= 0 && next < images.length) index = next;
    }

    function handleKeydown(event: KeyboardEvent) {
        switch (event.key) {
            case "ArrowLeft":
                event.preventDefault();
                go(-1);
                break;
            case "ArrowRight":
                event.preventDefault();
                go(1);
                break;
            case "Home":
                event.preventDefault();
                index = 0;
                break;
            case "End":
                event.preventDefault();
                index = images.length - 1;
                break;
            case "Escape":
                event.preventDefault();
                void collapseViewer();
                break;
        }
    }

    function tileLabel(i: number) {
        return `查看图片 ${i + 1}`;
    }

    function markFailed(src: string) {
        failedImages = new Set(failedImages).add(src);
    }

    function markViewerImageLoaded(src: string) {
        loadedViewerImages = new Set(loadedViewerImages).add(src);
    }

    function prefersReducedMotion() {
        return (
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    }

    // 打开时聚焦查看器容器（键盘立即可用）
    $effect(() => {
        if (viewing) viewerEl?.focus();
    });

    // 缩略图条：active 项滚动居中（reduced-motion 直接跳转）
    $effect(() => {
        if (!viewing) return;
        thumbEls[index]?.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "nearest",
            inline: "center",
        });
    });
</script>

{#if viewing}
    <div
        class="moment-viewer moment-gallery-root"
        bind:this={viewerEl}
        role="group"
        aria-roledescription="图片查看器"
        tabindex="-1"
        onkeydown={handleKeydown}
    >
        <div class="moment-viewer__bar">
            <span class="moment-viewer__counter" aria-live="polite">
                {index + 1} / {images.length}
            </span>
            <div class="moment-viewer__actions">
                <button
                    type="button"
                    class="moment-viewer__icon-btn"
                    aria-label="查看原图"
                    onclick={() => openLightbox(index)}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M15 3h6v6" />
                        <path d="M9 21H3v-6" />
                        <path d="M21 3l-7 7" />
                        <path d="M3 21l7-7" />
                    </svg>
                </button>
                <button
                    type="button"
                    class="moment-viewer__icon-btn"
                    aria-label="收起"
                    onclick={collapseViewer}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M4 14h6v6" />
                        <path d="M20 10h-6V4" />
                        <path d="M14 10l7-7" />
                        <path d="M3 21l7-7" />
                    </svg>
                </button>
            </div>
        </div>

        <div class="moment-viewer__stage">
            <button
                type="button"
                class="moment-viewer__nav"
                aria-label="上一张"
                disabled={index === 0}
                onclick={() => go(-1)}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </button>
            {#key index}
                <button
                    type="button"
                    class="moment-viewer__stage-btn"
                    aria-label={current.alt ? `查看原图: ${current.alt}` : "查看原图"}
                    onclick={() => openLightbox(index)}
                >
                    {#if !loadedViewerImages.has(current.src) && !failedImages.has(current.src)}
                        <span class="moment-viewer__stage-loading" aria-hidden="true">
                            <span class="moment-gallery__spinner"></span>
                        </span>
                    {/if}
                    {#if failedImages.has(current.src)}
                        <span class="moment-gallery__fallback">图片无法加载</span>
                    {:else}
                        <img
                            src={current.src}
                            alt=""
                            loading="eager"
                            decoding="async"
                            referrerpolicy="no-referrer"
                            class:moment-viewer__stage-img--loaded={loadedViewerImages.has(current.src)}
                            onload={() => markViewerImageLoaded(current.src)}
                            onerror={() => markFailed(current.src)}
                        />
                    {/if}
                </button>
            {/key}
            <button
                type="button"
                class="moment-viewer__nav"
                aria-label="下一张"
                disabled={index === images.length - 1}
                onclick={() => go(1)}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </button>
        </div>

        {#if current.alt}
            <p class="moment-viewer__caption">{current.alt}</p>
        {/if}

        <div class="moment-viewer__thumbs">
            {#each images as image, i (image.src + i)}
                <button
                    type="button"
                    class="moment-viewer__thumb"
                    class:moment-viewer__thumb--active={i === index}
                    bind:this={thumbEls[i]}
                    aria-label={tileLabel(i)}
                    aria-current={i === index}
                    onclick={() => (index = i)}
                >
                    {#if failedImages.has(image.src)}
                        <span class="moment-gallery__fallback moment-gallery__fallback--thumb">图片无法加载</span>
                    {:else}
                        <img
                            src={image.src}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            referrerpolicy="no-referrer"
                            onerror={() => markFailed(image.src)}
                        />
                    {/if}
                </button>
            {/each}
        </div>
    </div>
{:else}
    <div class="moment-gallery moment-gallery-root moment-gallery--{gridVariant}" bind:this={gridEl}>
        {#each visibleImages as image, i (image.src + i)}
            <button
                type="button"
                class="moment-gallery__tile"
                class:moment-gallery__tile--single={gridVariant === "single"}
                class:moment-gallery__tile--hero={gridVariant === "mosaic" && i === 0}
                aria-label={tileLabel(i)}
                onclick={() => (images.length === 1 ? openLightbox(0) : openViewer(i))}
            >
                {#if startedTiles.has(image.src) && !loadedTiles.has(image.src) && !failedImages.has(image.src)}
                    <span class="moment-gallery__tile-loading" aria-hidden="true">
                        <span class="moment-gallery__spinner"></span>
                    </span>
                {/if}
                {#if failedImages.has(image.src)}
                    <span class="moment-gallery__fallback">图片无法加载</span>
                {:else}
                    <img
                        src={image.src}
                        alt={image.alt ?? ""}
                        loading="lazy"
                        decoding="async"
                        referrerpolicy="no-referrer"
                        class:moment-gallery__tile-img--loaded={loadedTiles.has(image.src)}
                        onloadstart={() => (startedTiles = new Set(startedTiles).add(image.src))}
                        onload={() => (loadedTiles = new Set(loadedTiles).add(image.src))}
                        onerror={() => markFailed(image.src)}
                    />
                {/if}
                {#if remainder > 0 && i === MAX_TILES - 1}
                    <span class="moment-gallery__more" aria-hidden="true">+{remainder}</span>
                {/if}
            </button>
        {/each}
    </div>
{/if}

<style>
    /* muted 色：亮色降饱和灰，暗色换亮（与站点其它组件做法一致） */
    .moment-gallery-root {
        --muted: oklch(0.48 0.02 var(--hue));
    }
    :global(:root.dark) .moment-gallery-root {
        --muted: oklch(0.78 0.02 var(--hue));
    }
    .moment-gallery-root :focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
    }

    /* ===== 网格态 ===== */
    .moment-gallery {
        display: grid;
        gap: 0.5rem;
        margin-top: 0.875rem;
    }
    /* 桌面端限宽：多图网格的格子保持精致尺度，窄屏自然全宽 */
    .moment-gallery--pair {
        grid-template-columns: repeat(2, 1fr);
        max-width: 30rem;
    }
    /* 3 图拼图：左大图跨两行 + 右侧两方格，整体拼成一个正方形 */
    .moment-gallery--mosaic {
        grid-template-columns: 2fr 1fr;
        grid-template-rows: 1fr 1fr;
        max-width: 30rem;
    }
    .moment-gallery--trio {
        grid-template-columns: repeat(3, 1fr);
        max-width: 38rem;
    }

    .moment-gallery__tile {
        position: relative;
        display: flex;
        padding: 0;
        border: none;
        overflow: hidden;
        border-radius: 0.5rem;
        aspect-ratio: 1;
        background: var(--btn-regular-bg);
        cursor: zoom-in;
    }
    .moment-gallery__tile > img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        /* 加载前隐藏（指示器占位），加载完成后淡入 */
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    .moment-gallery__tile > img.moment-gallery__tile-img--loaded {
        opacity: 1;
    }
    /* 单图：固定 4:3 比例盒（限宽 30rem）。
       不用自然尺寸：lazy 图片加载前无内在尺寸，fit-content 会塌成 0×0，
       Chrome 对零尺寸元素的懒加载可能永不触发 */
    .moment-gallery__tile--single {
        aspect-ratio: 4 / 3;
        width: 100%;
        max-width: 30rem;
        border-radius: 0.75rem;
    }
    .moment-gallery__tile--single > img {
        height: 100%;
        object-fit: cover;
    }
    /* 拼图大图：跨两行由行高撑满（与右列两方格等比成正方形） */
    .moment-gallery__tile--hero {
        grid-row: span 2;
        aspect-ratio: auto;
    }

    /* 瓦片加载指示器：lazy 图开始加载后出现，加载完成即卸载（避免离屏空转） */
    .moment-gallery__tile-loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--btn-regular-bg);
        pointer-events: none;
    }

    /* 纯 CSS spinner：1.5rem 圆环 */
    .moment-gallery__spinner {
        display: block;
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid var(--primary);
        border-right-color: transparent;
        border-radius: 50%;
        animation: moment-gallery-spin 0.8s linear infinite;
    }
    @keyframes moment-gallery-spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* 图片加载失败占位（瓦片/主图/缩略图通用） */
    .moment-gallery__fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        box-sizing: border-box;
        border: 1px dashed var(--line-divider);
        border-radius: 0.4rem;
        background: var(--btn-regular-bg);
        color: var(--muted);
        font-size: 0.8rem;
        line-height: 1.3;
        text-align: center;
    }
    .moment-gallery__fallback--thumb {
        padding: 0.15rem;
        font-size: 0.6rem;
    }

    .moment-gallery__more {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        /* 图片折叠遮罩：站点规范允许的唯一固定黑/白叠加 */
        background: rgb(0 0 0 / 60%);
        color: rgb(255 255 255);
        font-size: 1.25rem;
        font-weight: 600;
    }

    /* ===== 查看器态（卡片内展开） ===== */
    .moment-viewer {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 0.875rem;
        padding: 0.75rem;
        border-radius: 0.75rem;
        background: var(--btn-regular-bg);
        border: 1px solid var(--line-divider);
        outline: none;
        animation: moment-viewer-in 0.3s ease;
    }

    .moment-viewer__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .moment-viewer__counter {
        padding: 0.1875rem 0.625rem;
        border-radius: 999px;
        border: 1px solid var(--line-divider);
        background: var(--card-bg);
        color: var(--muted);
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
    }

    .moment-viewer__actions {
        display: inline-flex;
        gap: 0.25rem;
    }

    .moment-viewer__icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        padding: 0;
        border: 1px solid var(--line-divider);
        border-radius: 0.4rem;
        background: var(--card-bg);
        color: var(--muted);
        cursor: pointer;
        transition: color 0.2s ease, border-color 0.2s ease;
    }
    .moment-viewer__icon-btn:hover {
        color: var(--primary);
        border-color: var(--primary);
    }
    .moment-viewer__icon-btn svg {
        width: 1rem;
        height: 1rem;
    }

    .moment-viewer__stage {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .moment-viewer__stage-btn {
        position: relative;
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 16 / 9;
        max-height: 26rem;
        padding: 0;
        border: none;
        background: var(--card-bg);
        border-radius: 0.5rem;
        overflow: hidden;
        cursor: zoom-in;
    }
    .moment-viewer__stage-btn > img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    .moment-viewer__stage-btn > img.moment-viewer__stage-img--loaded {
        opacity: 1;
    }

    .moment-viewer__stage-loading {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }

    .moment-viewer__nav {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: 1px solid var(--line-divider);
        border-radius: 999px;
        background: var(--card-bg);
        color: var(--deep-text);
        cursor: pointer;
        transition: color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
    }
    .moment-viewer__nav:hover:not(:disabled) {
        color: var(--primary);
        border-color: var(--primary);
    }
    .moment-viewer__nav:disabled {
        cursor: not-allowed;
        opacity: 0.4;
    }
    .moment-viewer__nav svg {
        width: 1.25rem;
        height: 1.25rem;
    }

    .moment-viewer__caption {
        margin: 0;
        text-align: center;
        color: var(--muted);
        font-size: 0.8rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .moment-viewer__thumbs {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding-bottom: 0.25rem;
        scroll-snap-type: x proximity;
        scrollbar-width: none;
    }
    .moment-viewer__thumbs::-webkit-scrollbar {
        display: none;
    }

    .moment-viewer__thumb {
        flex-shrink: 0;
        width: 3.5rem;
        height: 3.5rem;
        padding: 0;
        border: none;
        overflow: hidden;
        border-radius: 0.4rem;
        background: var(--card-bg);
        opacity: 0.7;
        cursor: pointer;
        scroll-snap-align: center;
        transition: opacity 0.2s ease;
    }
    .moment-viewer__thumb:hover {
        opacity: 1;
    }
    .moment-viewer__thumb > img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .moment-viewer__thumb--active {
        opacity: 1;
        box-shadow: 0 0 0 2px var(--primary);
    }

    /* 查看器入场动效 */
    @keyframes moment-viewer-in {
        from {
            opacity: 0;
            transform: scale(0.98);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    @media (max-width: 639.98px) {
        .moment-viewer__stage-btn {
            max-height: 18rem;
        }
        .moment-viewer__thumb {
            width: 2.75rem;
            height: 2.75rem;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .moment-viewer {
            animation: none;
        }
        .moment-gallery__tile > img,
        .moment-viewer__stage-btn > img,
        .moment-viewer__thumb {
            transition: none;
        }
    }
</style>
