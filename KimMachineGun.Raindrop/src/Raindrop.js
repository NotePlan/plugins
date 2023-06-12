// @flow

declare type RaindropType = 'link' | 'article' | 'image' | 'video' | 'document' | 'audio';

declare type RaindropCacheStatus = 'ready' | 'retry' | 'failed' | 'invalid-origin' | 'invalid-timeout' | 'invalid-size';

declare type RaindropHighlightColor =
    'blue'
    | 'brown'
    | 'cyan'
    | 'gray'
    | 'green'
    | 'indigo'
    | 'orange'
    | 'pink'
    | 'purple'
    | 'red'
    | 'teal'
    | 'yellow';

declare class Raindrop {
    // Impossible to create Paragraphs manually
    constructor(_: empty): empty;
    /**
     * Unique identifier of raindrop
     */
    _id: string;

    /**
     * Collection that the raindrop resides in
     */
    collection: {
        /**
         * Unique identifier of collection
         */
        $id: number;
    };

    /**
     * Raindrop cover URL
     */
    cover: string;

    /**
     * Creation date
     */
    created: string;

    /**
     * Hostname of a link.
     * Files always have `raindrop.io` hostname
     */
    domain: string;

    /**
     * Description; max length: 10000
     */
    excerpt: string;

    /**
     * Update date
     */
    lastUpdate: string;

    /**
     * URL
     */
    link: string;

    /**
     * Covers list in format
     */
    media: Array<{
        /**
         * URL of cover
         */
        link: string;
    }>;

    /**
     * Tags list
     */
    tags: Array<string>;

    /**
     * Title; max length: 1000
     */
    title: string;

    /**
     * `link` `article` `image` `video` `document` or `audio`
     */
    type: RaindropType;

    /**
     * Raindrop owner
     */
    user: {
        /**
         * Unique Identifier of raindrop owner
         */
        $id: number;
    };

    /**
     * Marked as broken (original `link` is not reachable anymore)
     */
    borken: boolean;

    /**
     * Permanent copy (cached version) details
     */
    cache: {
        /**
         * `ready` `retry` `failed` `invalid-origin` `invalid-timeout` or `invalid-size`
         */
        status: RaindropCacheStatus;

        /**
         * Full size in bytes
         */
        size: number;

        /**
         * Date when copy is successfully made
         */
        created: number;
    };

    /**
     * Sometime raindrop may belong to other user, not to the one who create it.
     * For example when this raindrop is created in shared collection by other user.
     * This object contains info about original author.
     */
    creatorRef: {
        /**
         * Original author (user ID) of a raindrop
         */
        _id: number;

        /**
         * Original author name of a raindrop
         */
        fullName: number;
    };

    /**
     * This raindrop uploaded from desktop
     */
    file: {
        /**
         * File name
         */
        name: string;

        /**
         * File size in bytes
         */
        size: number;

        /**
         * Mime type
         */
        type: string;
    };

    /**
     * Marked as "favorite"
     */
    important: boolean;

    /**
     * Highlights in this raindrop
     */
    highlights: Array<{
        /**
         * Unique id of highlight
         */
        _id: string;

        /**
         * Text of highlight (required)
         */
        text: string;

        /**
         * Color of highlight.
         * Default `yellow`
         *
         * Can be `blue`, `brown`, `cyan`, `gray`, `green`, `indigo`, `orange`, `pink`, `purple`, `red`, `teal`, `yellow`
         */
        color: RaindropHighlightColor;


        /**
         * Optional note for highlight
         */
        note: string;

        /**
         * Creation date of highlight
         */
        created: string;
    }>;


    /**
     * Highlight of this raindrop
     * NOT DOCUMENTED IN RAINDROP.IO
     */
    highlight: {
        /**
         * Highlight of this raindrop
         */
        body: string
    }
}

// TODO: type all fields in [Collections](https://developer.raindrop.io/v1/collections)
declare class Collection {
    // Impossible to create Paragraphs manually
    constructor(_: empty): empty;
    /**
     * The id of the collection
     */
    _id: string;

    /**
     * Name of the collection
     */
    title: string;
}
