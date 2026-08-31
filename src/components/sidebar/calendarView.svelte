<script lang="ts">
    import type { CalendarPost } from "@utils/postCalendar";

    interface Props {
        locale: string;
        startOfWeek: "mon" | "sun";
        postsByDate: Record<string, CalendarPost[]>;
        activeMonths: string[];
        labels: {
            previousMonth: string;
            nextMonth: string;
            returnToCurrentMonth: string;
            postsOnDate: string;
        };
    }

    let { locale, startOfWeek, postsByDate, activeMonths, labels }: Props = $props();

    const today = new Date();
    let year = $state(today.getFullYear());
    let month = $state(today.getMonth());
    let selectedDate = $state<string | null>(null);

    const monthTitle = $derived(
        new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(
            new Date(year, month, 1),
        ),
    );
    const weekStartOffset = $derived(startOfWeek === "mon" ? 1 : 0);
    const weekdays = $derived(
        Array.from({ length: 7 }, (_, index) => {
            const day = (index + weekStartOffset) % 7;
            return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
                new Date(2021, 0, 3 + day),
            );
        }),
    );

    const pad = (value: number) => String(value).padStart(2, "0");
    const dateKey = (targetYear: number, targetMonth: number, day: number) =>
        `${targetYear}-${pad(targetMonth + 1)}-${pad(day)}`;

    interface DayCell {
        day: number;
        key: string;
        posts: CalendarPost[];
    }

    const cells = $derived.by(() => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const leading = (firstDay - weekStartOffset + 7) % 7;
        const result: (DayCell | null)[] = Array.from({ length: leading }, () => null);

        for (let day = 1; day <= daysInMonth; day += 1) {
            const key = dateKey(year, month, day);
            result.push({ day, key, posts: postsByDate[key] ?? [] });
        }

        return result;
    });

    const selectedPosts = $derived(selectedDate ? (postsByDate[selectedDate] ?? []) : []);
    const currentMonthKey = $derived(`${year}-${pad(month + 1)}`);
    const isCurrentMonth = $derived(
        year === today.getFullYear() && month === today.getMonth(),
    );
    const previousMonth = $derived.by(() => {
        let previous: string | null = null;
        for (const key of activeMonths) {
            if (key < currentMonthKey) previous = key;
            else break;
        }
        return previous;
    });
    const nextMonth = $derived(activeMonths.find((key) => key > currentMonthKey) ?? null);

    function moveTo(target: string | null) {
        if (!target) return;
        const [nextYear, nextMonth] = target.split("-").map(Number);
        year = nextYear;
        month = nextMonth - 1;
        selectedDate = null;
    }

    function returnToCurrentMonth() {
        year = today.getFullYear();
        month = today.getMonth();
        selectedDate = null;
    }

    function toggleDay(cell: DayCell) {
        if (cell.posts.length === 0) return;
        selectedDate = selectedDate === cell.key ? null : cell.key;
    }

    function isToday(cell: DayCell) {
        return cell.key === dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    }
</script>

<div class="post-calendar">
    <header class="post-calendar__header">
        <button
            type="button"
            class="post-calendar__navigation"
            disabled={!previousMonth}
            aria-label={labels.previousMonth}
            onclick={() => moveTo(previousMonth)}
        >
            <span aria-hidden="true">‹</span>
        </button>
        <h2 class="post-calendar__title">{monthTitle}</h2>
        <button
            type="button"
            class="post-calendar__navigation"
            disabled={!nextMonth}
            aria-label={labels.nextMonth}
            onclick={() => moveTo(nextMonth)}
        >
            <span aria-hidden="true">›</span>
        </button>
    </header>

    {#if !isCurrentMonth}
        <button
            type="button"
            class="post-calendar__current-month"
            onclick={returnToCurrentMonth}
        >
            {labels.returnToCurrentMonth}
        </button>
    {/if}

    <div class="post-calendar__weekdays">
        {#each weekdays as weekday}
            <span>{weekday}</span>
        {/each}
    </div>

    {#key currentMonthKey}
        <div class="post-calendar__grid">
            {#each cells as cell}
                {#if cell}
                    <button
                        type="button"
                        class:post-calendar__day={true}
                        class:post-calendar__day--has-posts={cell.posts.length > 0}
                        class:post-calendar__day--today={isToday(cell)}
                        class:post-calendar__day--selected={selectedDate === cell.key}
                        disabled={cell.posts.length === 0}
                        aria-current={isToday(cell) ? "date" : undefined}
                        aria-expanded={cell.posts.length > 0 ? selectedDate === cell.key : undefined}
                        aria-controls={cell.posts.length > 0 ? `post-calendar-posts-${cell.key}` : undefined}
                        aria-label={cell.posts.length ? `${labels.postsOnDate} ${cell.key}` : cell.key}
                        onclick={() => toggleDay(cell)}
                    >
                        {cell.day}
                    </button>
                {:else}
                    <span class="post-calendar__blank" aria-hidden="true"></span>
                {/if}
            {/each}
        </div>
    {/key}

    {#if selectedPosts.length > 0}
        <ul id={`post-calendar-posts-${selectedDate}`} class="post-calendar__posts">
            {#each selectedPosts as post}
                <li>
                    <a href={post.url}>{post.title}</a>
                    <time datetime={post.date}>{post.date}</time>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style lang="stylus">
    .post-calendar
        display: flex
        flex-direction: column
        gap: 0.5rem
        min-width: 0

        &__header
            display: grid
            grid-template-columns: 2rem minmax(0, 1fr) 2rem
            align-items: center
            gap: 0.25rem

        &__navigation,
        &__current-month,
        &__day
            border: 0
            background: transparent
            color: var(--deep-text)

        &__navigation
            display: grid
            width: 2rem
            height: 2rem
            place-items: center
            border-radius: 0.5rem
            font-size: 1.75rem
            line-height: 1
            cursor: pointer
            transition: background-color 160ms ease, color 160ms ease

            &:not(:disabled):hover
                background: var(--btn-plain-bg-hover)
                color: var(--primary)

            &:disabled
                opacity: 0.38
                cursor: default

        &__title
            min-width: 0
            padding: 0.25rem
            border-radius: 0.5rem
            font-size: 0.9375rem
            font-weight: 700
            line-height: 1.4
            overflow-wrap: anywhere


        &__current-month
            justify-self: center
            padding: 0.25rem 0.5rem
            border-radius: 0.5rem
            color: var(--primary)
            font-size: 0.8125rem
            font-weight: 700
            cursor: pointer
            transition: background-color 160ms ease, color 160ms ease

            &:hover
                background: var(--btn-plain-bg-hover)

        &__weekdays,
        &__grid
            display: grid
            grid-template-columns: repeat(7, minmax(0, 1fr))
            gap: 0.25rem

        &__weekdays span
            min-width: 0
            overflow-wrap: anywhere
            text-align: center
            font-size: clamp(0.5625rem, 2.5vw, 0.75rem)
            color: var(--content-meta)

        &__blank,
        &__day
            aspect-ratio: 1

        &__day
            display: grid
            min-width: 0
            place-items: center
            border-radius: 0.5rem
            font-size: clamp(0.6875rem, 3vw, 0.875rem)
            font-variant-numeric: tabular-nums

            &:disabled
                background: unquote("color-mix(in srgb, var(--content-meta), transparent 90%)")
                color: unquote("color-mix(in srgb, var(--content-meta), var(--deep-text) 35%)")
                cursor: not-allowed

            &--has-posts
                background: unquote("color-mix(in srgb, var(--primary), transparent 86%)")
                font-weight: 700
                cursor: pointer

                &:hover
                    background: unquote("color-mix(in srgb, var(--primary), transparent 76%)")

            &--today,
            &--today:disabled
                background: var(--primary)
                color: var(--page-bg)

            &--selected
                outline: 2px solid var(--primary)
                outline-offset: 1px

        &__posts
            display: flex
            flex-direction: column
            gap: 0.25rem
            max-height: 10rem
            margin: 0
            padding: 0.25rem 0 0
            overflow-y: auto
            list-style: none
            overscroll-behavior: contain

            li
                display: grid
                grid-template-columns: minmax(0, 1fr) auto
                align-items: start
                gap: 0.5rem
                padding: 0.375rem 0.5rem
                border-radius: 0.5rem

                &:hover
                    background: var(--btn-plain-bg-hover)

            a
                min-width: 0
                color: var(--deep-text)
                overflow-wrap: anywhere
                text-decoration: none

                &:hover
                    color: var(--primary)

            time
                color: var(--content-meta)
                font-size: 0.75rem
                font-variant-numeric: tabular-nums

    @media (prefers-reduced-motion: no-preference)
        .post-calendar__grid
            animation: post-calendar-reveal 180ms ease-out

    @media (prefers-reduced-motion: reduce)
        .post-calendar *,
        .post-calendar *::before,
        .post-calendar *::after
            animation-duration: 0.01ms !important
            transition-duration: 0.01ms !important

    @keyframes post-calendar-reveal
        from
            opacity: 0
            transform: translateY(0.25rem)
        to
            opacity: 1
            transform: translateY(0)
</style>
