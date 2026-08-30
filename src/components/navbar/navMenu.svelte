<script lang="ts">
import { onMount } from "svelte";

import { LinkPreset, type NavbarLink } from "@/types/config";
import { LinkPresets } from "@constants/link-presets";
import { url } from "@utils/url";
import { onClickOutside } from "@utils/widget";
import Icon from "@components/common/icon.svelte";


interface Props {
    links: NavbarLink[];
}

let { links }: Props = $props();
let isOpen = $state(false);

function togglePanel() {
    isOpen = !isOpen;
}

// 点击外部关闭面板
function handleClickOutside(event: MouseEvent) {
    if (!isOpen) return;
    onClickOutside(event, "nav-menu-panel", "nav-menu-switch", () => {
        isOpen = false;
    });
}

onMount(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
        document.removeEventListener("click", handleClickOutside);
    };
});
</script>

<style>
    .mobile-submenu { display: grid; margin: 0 .5rem .35rem 1.7rem; padding-left: .6rem; border-left: 1px solid var(--line-divider); }
    .mobile-submenu-item { display: flex; align-items: center; gap: .5rem; padding: .45rem .6rem; border-radius: .4rem; color: var(--deep-text); font-size: .8rem; }
    .mobile-submenu-item:hover { color: var(--primary); background: var(--btn-plain-bg-hover); }
    :global(:root.dark) .mobile-submenu-item { color: var(--deep-text); }
</style>

<div class="relative md:hidden">
    <button aria-label="Menu" name="Nav Menu" class="btn-plain scale-animation rounded-lg w-11 h-11 active:scale-90" 
        id="nav-menu-switch"
        onclick={togglePanel}
    >
        <Icon icon="material-symbols:menu-rounded" class="text-[1.25rem]"></Icon>
    </button>
    <div id="nav-menu-panel" 
        class="float-panel fixed transition-all right-4 px-2 py-2 max-h-[80vh] overflow-y-auto"
        class:float-panel-closed={!isOpen}
    >
        {#each links as link}
            <div class="mobile-menu-item">
                <a href={link.external ? link.url : url(link.url)} 
                    class="group flex justify-between items-center py-2 pl-3 pr-1 rounded-lg gap-8 hover:bg-(--btn-plain-bg-hover) active:bg-(--btn-plain-bg-active) transition"
                    target={link.external ? "_blank" : null}
                >
                    <div class="flex items-center transition text-(--deep-text) font-bold group-hover:text-(--primary) group-active:text-(--primary)">
                        {#if link.icon}
                            <Icon icon={link.icon} class="text-[1.1rem] mr-2" />
                        {/if}
                        {link.name}
                    </div>
                    {#if !link.external}
                        <Icon icon="material-symbols:chevron-right-rounded" class="transition text-[1.25rem] text-(--primary)" />
                    {:else}
                        <Icon icon="fa6-solid:arrow-up-right-from-square" class="transition text-[0.75rem] text-(--deep-text)/40 -translate-x-1" />
                    {/if}
                </a>
                {#if link.children?.length}
                    <div class="mobile-submenu">
                        {#each link.children as child}
                            {@const childLink = typeof child === "number" ? LinkPresets[child as LinkPreset] : child}
                            <a href={childLink.external ? childLink.url : url(childLink.url)} target={childLink.external ? "_blank" : null} class="mobile-submenu-item">
                                {#if childLink.icon}<Icon icon={childLink.icon} class="text-[1rem]" />{/if}
                                <span>{childLink.name}</span>
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>