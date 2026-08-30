// Friends links data configuration file
// Used to manage data for the friends page
const friendModules = import.meta.glob('../content/friends/*.json', { eager: true });

export interface FriendLink {
    name: string;
    link: string;
    avatar: string;
    descr: string;
    feeds?: string;
    friendslink?: string;
    siteshot?: string;
    tags?: string[];
}

export interface FriendGroup {
    className: string;
    classDesc: string;
    linkList: FriendLink[];
}

export interface LatencyRecord {
    name?: string;
    link: string;
    latency: number;
    reachable: boolean;
}

export interface LatencyResponse {
    link_data: unknown;
}

export function normalizeFriendUrl(value: unknown): string | null {
    if (typeof value !== "string" || value.trim() === "") {
        return null;
    }

    const input = value.trim();
    try {
        const url = new URL(input);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }
        const authority = input.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1] ?? "";
        const hostWithPort = authority.slice(authority.lastIndexOf("@") + 1);
        const explicitPort = hostWithPort.startsWith("[")
            ? hostWithPort.match(/^\[[^\]]*\]:(\d+)$/)?.[1]
            : hostWithPort.match(/:(\d+)$/)?.[1];
        const pathname = url.pathname.replace(/\/+$/, "");
        return `${url.hostname.toLowerCase()}${explicitPort === undefined ? "" : `:${explicitPort}`}${pathname}${url.search}`;
    } catch {
        return null;
    }
}

export function toLatencyMilliseconds(record: unknown): number | null {
    if (typeof record !== "object" || record === null) {
        return null;
    }

    const candidate = record as Partial<LatencyRecord>;
    if (candidate.reachable !== true || typeof candidate.latency !== "number" || !Number.isFinite(candidate.latency) || candidate.latency < 0) {
        return null;
    }

    return Math.round(candidate.latency * 1000);
}

export function createLatencyIndex(response: unknown): Map<string, number> {
    if (typeof response !== "object" || response === null || !Array.isArray((response as LatencyResponse).link_data)) {
        return new Map();
    }

    const index = new Map<string, number>();
    const records = (response as LatencyResponse).link_data as unknown[];
    for (const record of records) {
        const key = normalizeFriendUrl((record as Partial<LatencyRecord>)?.link);
        const milliseconds = toLatencyMilliseconds(record);
        if (key !== null && milliseconds !== null && !index.has(key)) {
            index.set(key, milliseconds);
        }
    }
    return index;
}

type LocalFriendLink = FriendLink & {
    className: string;
    classDesc: string;
};

export const localFriendGroups: FriendGroup[] = Object.values(friendModules)
    .map((mod) => (mod as { default: LocalFriendLink }).default)
    .reduce<FriendGroup[]>((groups, { className, classDesc, ...link }) => {
        const group = groups.find((g) => g.className === className);
        if (group === undefined) {
            groups.push({ className, classDesc, linkList: [link] });
        } else {
            group.linkList.push(link);
        }
        return groups;
    }, []);

export function normalizeFriendGroups(raw: any): FriendGroup[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.map((group: any) => ({
        className: group?.class_name ?? "",
        classDesc: group?.class_desc ?? "",
        linkList: (Array.isArray(group?.link_list) ? group.link_list : [])
            .filter((link: any) => link?.name && link?.link)
            .map((link: any) => ({
                name: link.name,
                link: link.link,
                avatar: link.avatar ?? "",
                descr: link.descr ?? "",
                feeds: link.feeds ?? undefined,
                friendslink: link.friendslink ?? undefined,
                siteshot: link.siteshot ?? undefined,
                tags: Array.isArray(link.tags) ? link.tags : undefined,
            })),
    }));
}
