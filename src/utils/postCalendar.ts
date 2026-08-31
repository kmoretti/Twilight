import { formatDateToYYYYMMDD } from "@utils/date";
import { getSortedPosts } from "@utils/post";
import { getPostUrl } from "@utils/url";


export type CalendarPost = {
    title: string;
    url: string;
    date: string;
};

export type PostCalendarData = {
    postsByDate: Record<string, CalendarPost[]>;
    activeMonths: string[];
};

export async function getPostCalendarData(): Promise<PostCalendarData> {
    const posts = await getSortedPosts();
    const postsByDate: Record<string, CalendarPost[]> = {};
    const activeMonths = new Set<string>();

    for (const post of posts) {
        const date = formatDateToYYYYMMDD(post.data.published);
        const month = date.slice(0, 7);

        activeMonths.add(month);
        (postsByDate[date] ||= []).push({
            title: post.data.title,
            url: getPostUrl(post),
            date,
        });
    }

    return {
        postsByDate,
        activeMonths: Array.from(activeMonths).sort(),
    };
}
