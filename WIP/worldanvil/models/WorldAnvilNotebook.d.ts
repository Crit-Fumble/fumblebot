/**
 * World Anvil Notebook Models
 * Contains interfaces and types related to World Anvil notebooks, notes, and note sections
 *
 * NOTE: According to the API docs, this endpoint will be replaced with a /user/notebooks endpoint in the future
 * and currently does not work.
 */
/**
 * Interface for notebook reference
 */
export interface NotebookRef {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    user_id: string;
    [key: string]: any;
}
/**
 * Interface for notebook data with varying levels of detail
 */
export interface NotebookResponse {
    id: string;
    title: string;
    slug: string;
    world_id: string;
    user_id: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
/**
 * Interface for notebook creation input
 */
export interface NotebookInput {
    title: string;
    world: {
        id: string;
    };
    description?: string;
    [key: string]: any;
}
/**
 * Interface for notebook update input
 */
export interface NotebookUpdateInput {
    title?: string;
    description?: string;
    [key: string]: any;
}
/**
 * Interface for API response from world-notebooks endpoint
 */
export interface WorldNotebooksResponse {
    success: boolean;
    entities: NotebookRef[];
}
/**
 * Interface for request options to get notebooks
 */
export interface NotebookListOptions {
    offset?: number;
    limit?: number;
}
/**
 * Interface for note reference
 */
export interface NoteRef {
    id: string;
    title: string;
    notesection_id: string;
    [key: string]: any;
}
/**
 * Interface for note data with varying levels of detail
 */
export interface NoteResponse {
    id: string;
    title: string;
    content?: string;
    notesection_id: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
/**
 * Interface for note creation input
 */
export interface NoteInput {
    title: string;
    content?: string;
    notesection: {
        id: string;
    };
    [key: string]: any;
}
/**
 * Interface for note update input
 */
export interface NoteUpdateInput {
    title?: string;
    content?: string;
    [key: string]: any;
}
/**
 * Interface for note section reference
 */
export interface NoteSectionRef {
    id: string;
    title: string;
    notebook_id: string;
    [key: string]: any;
}
/**
 * Interface for note section data with varying levels of detail
 */
export interface NoteSectionResponse {
    id: string;
    title: string;
    notebook_id: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: any;
}
/**
 * Interface for note section creation input
 */
export interface NoteSectionInput {
    title: string;
    notebook: {
        id: string;
    };
    description?: string;
    [key: string]: any;
}
/**
 * Interface for note section update input
 */
export interface NoteSectionUpdateInput {
    title?: string;
    description?: string;
    [key: string]: any;
}
/**
 * Interface for API response from notebook-notesections endpoint
 */
export interface NotebookNoteSectionsResponse {
    success: boolean;
    entities: NoteSectionRef[];
}
/**
 * Interface for API response from notesection-notes endpoint
 */
export interface NoteSectionNotesResponse {
    success: boolean;
    entities: NoteRef[];
}
//# sourceMappingURL=WorldAnvilNotebook.d.ts.map