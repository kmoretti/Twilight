<script lang="ts">
    import MomentsCard from "./moments/MomentsCard.svelte";
    import MomentGallery from "./moments/MomentGallery.svelte";

    interface LocalMoment {
        id: string;
        title?: string;
        content: string;
        timeText: string;
        images: string[];
    }

    let { moments = [], author = "", avatar = "" }: { moments?: LocalMoment[]; author?: string; avatar?: string } = $props();
</script>

{#if moments.length === 0}
    <div class="local-diary-empty">暂无日记</div>
{:else}
    <div class="local-diary-list">
        {#each moments as moment (moment.id)}
            {#snippet content()}
                {#if moment.title}<h2 class="local-title">{moment.title}</h2>{/if}
                <p class="local-content">{moment.content}</p>
                {#if moment.images.length > 0}<MomentGallery images={moment.images.map(src => ({ src, alt: "日记图片" }))} />{/if}
            {/snippet}
            <MomentsCard item={{ id: moment.id, author, avatar, datetime: moment.timeText, tags: [] }} {content} />
        {/each}
    </div>
{/if}

<style>
    .local-diary-list {
        display: grid;
        gap: 1rem;
    }

    .local-title {
        margin: 0 0 0.375rem;
        font-size: 1rem;
        font-weight: 700;
        color: var(--deep-text);
    }

    .local-content {
        margin: 0;
        white-space: pre-line;
        font-size: 0.92rem;
        line-height: 1.75;
    }

    .local-diary-empty {
        --muted: oklch(0.48 0.02 var(--hue));
        padding: 2.5rem 1rem;
        border: 1px dashed var(--line-divider);
        border-radius: 0.9rem;
        background: var(--card-bg);
        color: var(--muted);
        font-size: 0.9rem;
        text-align: center;
    }
    :global(:root.dark) .local-diary-empty {
        --muted: oklch(0.78 0.02 var(--hue));
    }
</style>
