<script lang="ts">
    import { onMount } from "svelte";

    const API = "https://verify.081531.xyz/api/submissions";
    type FormMode = "apply" | "update";
    type Status = "pending" | "approved" | "rejected";
    type Submission = { name: string; description?: string; status: Status; type?: "apply" | "update" };

    let conditions = $state([false, false, false, false, false]);
    let mode = $state<FormMode>("apply");
    let submitting = $state(false);
    let success = $state<FormMode | null>(null);
    let error = $state("");
    let submissions = $state<Submission[]>([]);
    let loading = $state(true);
    let listError = $state("");
    let statusFilter = $state<"" | Status>("");
    let search = $state("");
    let page = $state(1);
    const pageSize = 12;

    let form: Record<string, string> = $state({});
    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    let infoFormat = $state<"json" | "yaml">("json");
    let copied = $state(false);

    const siteInfo = {
        name: "喵洛阁",
        url: "https://b.kemeow.top/",
        description: "克喵的个人博客",
        author: "克喵Moretti",
        avatar: "https://b.kemeow.top/assets/images/avatar.png",
        rss: "https://b.kemeow.top/rss.xml",
        siteshot: "https://b.kemeow.top/assets/images/bg1-piclite.webp",
    };
    const infoJson = JSON.stringify(siteInfo, null, 2);
    const infoYaml = `name: ${siteInfo.name}\nurl: ${siteInfo.url}\ndescription: ${siteInfo.description}\nauthor: ${siteInfo.author}\navatar: ${siteInfo.avatar}\nrss: ${siteInfo.rss}\nsiteshot: ${siteInfo.siteshot}`;
    const infoContent = $derived(infoFormat === "json" ? infoJson : infoYaml);

    const allChecked = $derived(conditions.every(Boolean));
    const filtered = $derived(submissions.filter((item) => {
        const matchesStatus = !statusFilter || item.status === statusFilter;
        const matchesSearch = !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase());
        return matchesStatus && matchesSearch;
    }));
    const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
    const pageItems = $derived(filtered.slice((page - 1) * pageSize, page * pageSize));

    async function copySiteInfo() {
        try {
            await navigator.clipboard.writeText(infoContent);
            copied = true;
            setTimeout(() => copied = false, 1600);
        } catch {
            copied = false;
        }
    }

    function chooseMode(next: FormMode) {
        mode = next;
        success = null;
        error = "";
        form = {};
    }

    function statusText(status: Status) {
        return { pending: "待审核", approved: "已通过", rejected: "已拒绝" }[status];
    }

    function resetPage() {
        page = 1;
    }

    async function loadSubmissions() {
        loading = true;
        listError = "";
        try {
            const response = await fetch(`${API}?public=1`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            submissions = Array.isArray(data.submissions) ? data.submissions : [];
        } catch {
            listError = "申请列表加载失败，请稍后重试。";
        } finally {
            loading = false;
        }
    }

    async function submit(event: SubmitEvent) {
        event.preventDefault();
        submitting = true;
        error = "";
        const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
        payload.type = mode;
        if (mode === "update") payload.originalUrl = payload.originalUrl || "";
        try {
            const response = await fetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "提交失败，请检查填写内容。\n");
            success = mode;
            form = {};
            await loadSubmissions();
        } catch (reason) {
            error = reason instanceof Error ? reason.message.trim() : "提交失败，请稍后重试。";
        } finally {
            submitting = false;
        }
    }

    function handleSearch(value: string) {
        search = value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(resetPage, 180);
    }

    onMount(() => {
        loadSubmissions();
        return () => clearTimeout(searchTimer);
    });
</script>

<section class="friendlink-system" aria-labelledby="friendlink-title">
    <div class="system-card">
        <h2 id="friendlink-title">友链申请</h2>
        <p class="intro">请先确认满足以下条件，再选择申请或更新友链信息。</p>

        <div class="site-info" aria-labelledby="site-info-title">
            <div class="site-info-header"><div><h3 id="site-info-title">本站友链信息</h3><p>复制以下信息即可添加本站友链。</p></div><button type="button" class="copy-button" onclick={copySiteInfo}>{copied ? "已复制" : "一键复制"}</button></div>
            <div class="info-tabs" role="tablist" aria-label="友链信息格式">
                <button type="button" role="tab" aria-selected={infoFormat === "json"} class:active={infoFormat === "json"} onclick={() => infoFormat = "json"}>JSON</button>
                <button type="button" role="tab" aria-selected={infoFormat === "yaml"} class:active={infoFormat === "yaml"} onclick={() => infoFormat = "yaml"}>YAML</button>
            </div>
            <pre><code>{infoContent}</code></pre>
        </div>
        <div class="conditions">
            <label><input type="checkbox" bind:checked={conditions[0]} />我已添加 <strong>喵洛阁</strong> 的友情链接</label>
            <label><input type="checkbox" bind:checked={conditions[1]} />我的网站现在可以在中国大陆区域正常访问</label>
            <label><input type="checkbox" bind:checked={conditions[2]} />网站内容符合中国大陆法律法规</label>
            <label><input type="checkbox" bind:checked={conditions[3]} />我的链接主体为<strong>个人</strong>，网站类型为<strong>博客</strong></label>
            <label><input type="checkbox" bind:checked={conditions[4]} />网站域名不是 us.kg 等免费域名（github.io、gitee.io 除外）</label>
        </div>

        {#if !allChecked}
            <p class="hint warning">⚠ 请先勾选所有条件后再填写申请表单</p>
        {:else}
            <div class="mode-buttons" role="tablist" aria-label="友链操作">
                <button type="button" class:active={mode === "apply"} onclick={() => chooseMode("apply")}>申请友链</button>
                <button type="button" class:active={mode === "update"} onclick={() => chooseMode("update")}>更新友链/信息</button>
            </div>
            {#if success === mode}
                <div class="success" role="status"><span aria-hidden="true">✓</span><h3>提交成功</h3><p>感谢您！申请已提交，等待管理员审核。<br />审核结果将通过邮件通知您。</p></div>
            {:else}
                <form onsubmit={submit}>
                    {#if mode === "update"}
                        <div class="field"><label for="originalUrl">原站点地址 <i>*</i></label><input id="originalUrl" type="url" required placeholder="原来的网站地址" bind:value={form.originalUrl} /></div>
                        <hr />
                    {/if}
                    <div class="field"><label for="name">{mode === "update" ? "新" : ""}站点名称 <i>*</i></label><input id="name" required placeholder="站点名称" bind:value={form.name} /></div>
                    <div class="field"><label for="url">{mode === "update" ? "新" : ""}站点地址 <i>*</i></label><input id="url" type="url" required placeholder="网站地址" bind:value={form.url} /></div>
                    <div class="field"><label for="description">{mode === "update" ? "新" : ""}站点描述</label><input id="description" placeholder="例如：一个关于技术和设计的博客" bind:value={form.description} /></div>
                    <div class="field"><label for="avatar">{mode === "update" ? "新" : ""}头像地址 <i>*</i></label><input id="avatar" type="url" required placeholder="头像地址" bind:value={form.avatar} /></div>
                    <div class="field"><label for="friendslink">友链页面 <i>*</i></label><input id="friendslink" type="url" required placeholder="你的友链页面地址" bind:value={form.friendslink} /></div>
                    <div class="field"><label for="siteshot">{mode === "update" ? "新" : ""}站点截图</label><input id="siteshot" type="url" placeholder="站点截图链接（支持 siteshot 和 topimg 字段）" bind:value={form.siteshot} /></div>
                    <div class="field"><label for="feeds">RSS 订阅</label><input id="feeds" type="url" placeholder="RSS 订阅地址" bind:value={form.feeds} /></div>
                    <div class="field"><label for="email">邮箱</label><input id="email" type="email" placeholder="联系邮箱（选填，用于接收审核结果通知）" bind:value={form.email} /></div>
                    <p class="hint">用于接收审核结果通知</p>
                    {#if error}<p class="error" role="alert">{error}</p>{/if}
                    <button class="submit" type="submit" disabled={submitting}>{submitting ? "提交中..." : "提交"}</button>
                </form>
            {/if}
        {/if}
    </div>

    <div class="system-card status-card">
        <div class="status-header"><h2>友链申请列表 <small>共 {filtered.length} 条</small></h2><div class="filters"><select aria-label="状态筛选" bind:value={statusFilter} onchange={resetPage}><option value="">全部状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已拒绝</option></select><input aria-label="搜索名称" placeholder="搜索名称" value={search} oninput={(event) => handleSearch((event.currentTarget as HTMLInputElement).value)} /></div></div>
        {#if loading}<p class="list-message">加载中...</p>{:else if listError}<p class="list-message error">{listError}</p>{:else if pageItems.length === 0}<p class="list-message">暂无数据</p>{:else}<div class="status-grid">{#each pageItems as item}<article class="status-item"><div><strong title={item.name}>{item.name}</strong><span class="badges"><em class={`status ${item.status}`}>{statusText(item.status)}</em><em>{item.type === "update" ? "更新" : "新增"}</em></span></div><p title={item.description || "暂无描述"}>{item.description || "暂无描述"}</p></article>{/each}</div>{/if}
        {#if totalPages > 1}<nav class="pagination" aria-label="申请列表分页"><button type="button" disabled={page === 1} onclick={() => page--}>‹</button>{#each Array(totalPages) as _, index}<button type="button" class:active={page === index + 1} onclick={() => page = index + 1}>{index + 1}</button>{/each}<button type="button" disabled={page === totalPages} onclick={() => page++}>›</button></nav>{/if}
    </div>
</section>

<style>
    .friendlink-system { --status-warning: oklch(.45 .16 85); --status-warning-bg: oklch(.96 .05 95); --status-success: oklch(.42 .14 155); --status-success-bg: oklch(.94 .06 150); --status-error: oklch(.48 .18 25); --status-error-bg: oklch(.95 .04 25); display: grid; gap: 1.5rem; margin-top: 2rem; color: var(--deep-text); }
    :global(:root.dark) .friendlink-system { --status-warning: oklch(.82 .14 90); --status-warning-bg: oklch(.28 .06 90); --status-success: oklch(.78 .13 155); --status-success-bg: oklch(.27 .06 155); --status-error: oklch(.78 .14 25); --status-error-bg: oklch(.3 .07 25); }
    .system-card { padding: 1.25rem; border: 1px solid var(--line-divider); border-radius: var(--radius-large); background: var(--card-bg-transparent); }
    h2 { margin: 0 0 .35rem; font-size: 1.15rem; font-weight: 700; color: var(--deep-text); }
    .intro, .hint, .status-item p, .list-message { margin: 0; color: var(--neutral-500); font-size: .875rem; }
    .site-info { margin: 1.25rem 0; padding: 1rem; border: 1px solid var(--line-divider); border-radius: .75rem; background: var(--card-bg); }
    .site-info-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .site-info h3 { margin: 0; font-size: .95rem; font-weight: 700; color: var(--deep-text); }
    .site-info-header p { margin: .2rem 0 0; color: var(--neutral-500); font-size: .75rem; }
    .copy-button { flex-shrink: 0; border: 1px solid var(--line-divider); border-radius: .45rem; padding: .4rem .7rem; color: var(--deep-text); background: var(--btn-regular-bg); font-size: .75rem; }
    .copy-button:hover { color: var(--primary); border-color: var(--primary); }
    .info-tabs { display: flex; gap: .35rem; margin-top: .9rem; border-bottom: 1px solid var(--line-divider); }
    .info-tabs button { border: 0; border-bottom: 2px solid transparent; padding: .4rem .7rem; color: var(--neutral-500); background: transparent; font-size: .75rem; }
    .info-tabs button.active { color: var(--primary); border-bottom-color: var(--primary); }
    .site-info pre { max-height: 18rem; overflow: auto; margin: .75rem 0 0; padding: .8rem; border-radius: .5rem; color: var(--deep-text); background: var(--page-bg); font-size: .75rem; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
    .conditions { display: grid; gap: .5rem; margin: 1rem 0; }
    label { color: var(--deep-text); font-size: .875rem; }
    .conditions label { display: flex; gap: .5rem; align-items: flex-start; cursor: pointer; }
    input[type="checkbox"] { margin-top: .2rem; accent-color: var(--primary); }
    .warning { color: var(--status-error); }
    .mode-buttons { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; margin: 1rem 0; }
    button, input, select { font: inherit; }
    button { cursor: pointer; }
    .mode-buttons button, .submit { border: 0; border-radius: .6rem; padding: .65rem 1rem; color: var(--page-bg); background: var(--primary); transition: opacity .2s; }
    .mode-buttons button:not(.active) { color: var(--deep-text); background: var(--btn-regular-bg); border: 1px solid var(--line-divider); }
    .mode-buttons button:hover, .submit:hover { opacity: .85; }
    form { display: grid; gap: .8rem; padding: 1rem; border: 1px solid var(--line-divider); border-radius: .75rem; background: var(--card-bg); }
    .field { display: grid; gap: .3rem; }
    .field label { font-size: .8rem; font-weight: 600; }
    i { color: var(--status-error); font-style: normal; }
    input:not([type="checkbox"]), select { width: 100%; box-sizing: border-box; padding: .6rem .7rem; border: 1px solid var(--line-divider); border-radius: .5rem; color: var(--deep-text); background: var(--page-bg); outline: none; }
    input:not([type="checkbox"]):focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary), transparent 78%); }
    hr { width: 100%; border: 0; border-top: 1px solid var(--line-divider); }
    .submit:disabled { cursor: not-allowed; opacity: .55; }
    .error { margin: 0; padding: .65rem .8rem; border-radius: .5rem; color: var(--status-error); background: var(--status-error-bg); font-size: .85rem; white-space: pre-line; }
    .success { padding: 2rem 1rem; text-align: center; }.success span { display: block; color: var(--status-success); font-size: 2.5rem; }.success h3 { margin: .3rem 0; }.success p { margin: 0; color: var(--neutral-500); font-size: .875rem; }
    .status-header { display: flex; gap: 1rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; }.status-header h2 { margin: 0; }.status-header small { color: var(--neutral-500); font-size: .75rem; font-weight: 400; }.filters { display: flex; gap: .5rem; }.filters input, .filters select { width: auto; min-width: 8rem; padding: .4rem .55rem; font-size: .8rem; }
    .status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; }.status-item { min-width: 0; padding: .85rem; border: 1px solid var(--line-divider); border-radius: .65rem; background: var(--card-bg); }.status-item > div { display: flex; gap: .5rem; justify-content: space-between; align-items: flex-start; }.status-item strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.status-item p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: .35rem; font-size: .75rem; }.badges { display: flex; flex-shrink: 0; gap: .3rem; }.badges em { padding: .12rem .4rem; border: 1px solid var(--line-divider); border-radius: 999px; color: var(--neutral-500); font-size: .65rem; font-style: normal; white-space: nowrap; }.badges .status.pending { color: var(--status-warning); background: var(--status-warning-bg); }.badges .status.approved { color: var(--status-success); background: var(--status-success-bg); }.badges .status.rejected { color: var(--status-error); background: var(--status-error-bg); }.pagination { display: flex; justify-content: center; gap: .35rem; margin-top: 1rem; }.pagination button { min-width: 2rem; height: 2rem; border: 1px solid var(--line-divider); border-radius: .4rem; color: var(--deep-text); background: var(--card-bg); }.pagination button.active { color: var(--page-bg); border-color: var(--primary); background: var(--primary); }.pagination button:disabled { cursor: not-allowed; opacity: .4; }
    @media (max-width: 768px) { .status-header { align-items: stretch; flex-direction: column; }.filters { width: 100%; }.filters input, .filters select { min-width: 0; flex: 1; }.status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 480px) { .mode-buttons { grid-template-columns: 1fr; }.status-grid { grid-template-columns: 1fr; }.system-card { padding: 1rem; }.status-item > div { display: block; }.badges { margin-top: .4rem; } }
</style>
