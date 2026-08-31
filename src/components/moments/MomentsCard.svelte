<script lang="ts">
    import type { Snippet } from "svelte";

    export type MomentsCardItem = {
        id: string;
        author: string;
        avatar: string;
        datetime: string;
        tags: string[];
    };

    let {
        item,
        content,
        footer,
        class: className = "",
    }: {
        item: MomentsCardItem;
        content?: Snippet;
        footer?: Snippet;
        class?: string;
    } = $props();
</script>

<article class="moment-card {className}" id="moment-{item.id}">
    <header class="moment-card__header">
        <div class="moment-card__author">
            {#if item.avatar}
                <img class="moment-card__avatar" src={item.avatar} alt="" width="40" height="40" loading="lazy" />
            {/if}
            <span class="moment-card__name">{item.author}</span>
        </div>
        <time class="moment-card__time" datetime={item.datetime}>{item.datetime}</time>
    </header>

    {#if content}
        <div class="moment-card__content">
            {@render content()}
        </div>
    {/if}

    {#if footer}
        <footer class="moment-card__footer">
            {@render footer()}
        </footer>
    {/if}
</article>

<style>
    .moment-card {
        --muted: oklch(.48 .02 var(--hue));
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: 100%;
        padding: 1rem 1.25rem;
        border-radius: 0.9rem;
        background: var(--card-bg);
        border: 1px solid var(--line-divider);
        color: var(--deep-text);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    :global(:root.dark) .moment-card {
        --muted: oklch(.78 .02 var(--hue));
    }
    .moment-card:hover {
        border-color: color-mix(in oklch, var(--primary) 40%, var(--line-divider));
        box-shadow: 0 2px 12px color-mix(in oklch, var(--deep-text) 8%, transparent);
    }

    .moment-card__header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .moment-card__author {
        display: inline-flex;
        align-items: center;
        gap: 0.625rem;
        min-width: 0;
    }

    .moment-card__avatar {
        flex-shrink: 0;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 999px;
        object-fit: cover;
        background: var(--btn-regular-bg);
        border: 1px solid var(--line-divider);
    }

    .moment-card__name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
        font-size: 0.9rem;
        color: var(--deep-text);
    }

    .moment-card__time {
        flex-shrink: 0;
        margin-left: auto;
        color: var(--muted);
        font-size: 0.75rem;
    }

    .moment-card__content {
        margin-top: 0.75rem;
        color: var(--deep-text);
        font-size: 0.92rem;
        line-height: 1.75;
        overflow-wrap: break-word;
    }

    .moment-card__footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 0.875rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--line-divider);
    }

    @media (max-width: 512px) {
        .moment-card {
            padding: 0.875rem 1rem;
        }
    }
</style>
