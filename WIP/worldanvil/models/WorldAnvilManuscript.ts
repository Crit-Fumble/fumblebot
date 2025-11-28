/**
 * World Anvil Manuscript Models
 * Contains interfaces and types related to World Anvil manuscripts
 */

/**
 * Interface for manuscript reference
 */
export interface ManuscriptRef {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for manuscript data with varying levels of detail
 */
export interface ManuscriptResponse {
  id: string;
  title: string;
  slug: string;
  world_id: string;
  user_id: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional properties based on the schema
}

/**
 * Interface for manuscript creation input
 */
export interface ManuscriptInput {
  title: string;
  world: {
    id: string;
  };
  [key: string]: any; // For additional properties
}

/**
 * Interface for manuscript update input
 */
export interface ManuscriptUpdateInput {
  title?: string;
  state?: string;
  [key: string]: any; // For additional properties
}

/**
 * Interface for API response from world-manuscripts endpoint
 */
export interface WorldManuscriptsResponse {
  success: boolean;
  entities: ManuscriptRef[];
}

/**
 * Interface for request options to get manuscripts
 */
export interface ManuscriptListOptions {
  offset?: number;
  limit?: number;
}

/**
 * World Anvil Manuscript Sub-Resources Models
 * Contains interfaces and types related to World Anvil manuscript sub-resources like beats, parts, versions, etc.
 */

/**
 * Base interface for common fields across manuscript sub-resources
 */
interface ManuscriptSubResourceBase {
  id: string;
  title?: string;
  [key: string]: any;
}

/**
 * Interface for manuscript beat reference
 */
export interface ManuscriptBeatRef extends ManuscriptSubResourceBase {
  content?: string;
  part_id: string;
  position?: number;
}

/**
 * Interface for manuscript beat response
 */
export interface ManuscriptBeatResponse extends ManuscriptBeatRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript beat input
 */
export interface ManuscriptBeatInput {
  content: string;
  part: {
    id: string;
  };
  position?: number;
}

/**
 * Interface for manuscript beat update input
 */
export interface ManuscriptBeatUpdateInput {
  content?: string;
  position?: number;
  [key: string]: any;
}

/**
 * Interface for manuscript part reference
 */
export interface ManuscriptPartRef extends ManuscriptSubResourceBase {
  synopsis?: string;
  type?: string;
  version_id: string;
}

/**
 * Interface for manuscript part response
 */
export interface ManuscriptPartResponse extends ManuscriptPartRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript part input
 */
export interface ManuscriptPartInput {
  title?: string;
  type: string;
  version: {
    id: string;
  };
  synopsis?: string;
  image?: {
    id: string;
  };
}

/**
 * Interface for manuscript part update input
 */
export interface ManuscriptPartUpdateInput {
  title?: string;
  synopsis?: string;
  type?: string;
  image?: {
    id: string;
  };
}

/**
 * Interface for manuscript version reference
 */
export interface ManuscriptVersionRef extends ManuscriptSubResourceBase {
  manuscript_id: string;
  name?: string;
}

/**
 * Interface for manuscript version response
 */
export interface ManuscriptVersionResponse extends ManuscriptVersionRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript version input
 */
export interface ManuscriptVersionInput {
  name?: string;
  manuscript: {
    id: string;
  };
}

/**
 * Interface for manuscript version update input
 */
export interface ManuscriptVersionUpdateInput {
  name?: string;
}

/**
 * Interface for manuscript bookmark reference
 */
export interface ManuscriptBookmarkRef extends ManuscriptSubResourceBase {
  manuscript_id: string;
  note?: string;
}

/**
 * Interface for manuscript bookmark response
 */
export interface ManuscriptBookmarkResponse extends ManuscriptBookmarkRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript bookmark input
 */
export interface ManuscriptBookmarkInput {
  title: string;
  manuscript: {
    id: string;
  };
  note?: string;
}

/**
 * Interface for manuscript bookmark update input
 */
export interface ManuscriptBookmarkUpdateInput {
  title?: string;
  note?: string;
}

/**
 * Interface for API response from manuscript beats listing endpoint
 */
export interface ManuscriptBeatsResponse {
  success: boolean;
  entities: ManuscriptBeatRef[];
}

/**
 * Interface for API response from manuscript parts listing endpoint
 */
export interface ManuscriptPartsResponse {
  success: boolean;
  entities: ManuscriptPartRef[];
}

/**
 * Interface for API response from manuscript versions listing endpoint
 */
export interface ManuscriptVersionsResponse {
  success: boolean;
  entities: ManuscriptVersionRef[];
}

/**
 * Interface for API response from manuscript bookmarks listing endpoint
 */
export interface ManuscriptBookmarksResponse {
  success: boolean;
  entities: ManuscriptBookmarkRef[];
}

/**
 * Interface for manuscript tag reference
 * Based on manuscript-tag.yml specification
 */
export interface ManuscriptTagRef extends ManuscriptSubResourceBase {
  manuscript_id: string;
  title: string;
}

/**
 * Interface for manuscript tag response
 */
export interface ManuscriptTagResponse extends ManuscriptTagRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript tag input
 */
export interface ManuscriptTagInput {
  title: string;
  manuscript: {
    id: string;
  };
}

/**
 * Interface for manuscript tag update input
 */
export interface ManuscriptTagUpdateInput {
  title?: string;
}

/**
 * Interface for API response from manuscript tags listing endpoint
 */
export interface ManuscriptTagsResponse {
  success: boolean;
  entities: ManuscriptTagRef[];
}

/**
 * Interface for manuscript plot reference
 * Based on manuscript-plot.yml specification
 */
export interface ManuscriptPlotRef extends ManuscriptSubResourceBase {
  version_id: string;
  description?: string;
}

/**
 * Interface for manuscript plot response
 */
export interface ManuscriptPlotResponse extends ManuscriptPlotRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript plot input
 */
export interface ManuscriptPlotInput {
  title: string;
  version: {
    id: string;
  };
  description?: string;
}

/**
 * Interface for manuscript plot update input
 */
export interface ManuscriptPlotUpdateInput {
  title?: string;
  description?: string;
}

/**
 * Interface for API response from manuscript plots listing endpoint
 */
export interface ManuscriptPlotsResponse {
  success: boolean;
  entities: ManuscriptPlotRef[];
}

/**
 * Interface for manuscript label reference
 * Based on manuscript-label.yml specification
 */
export interface ManuscriptLabelRef extends ManuscriptSubResourceBase {
  manuscript_id: string;
  color?: string;
}

/**
 * Interface for manuscript label response
 */
export interface ManuscriptLabelResponse extends ManuscriptLabelRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript label input
 */
export interface ManuscriptLabelInput {
  title: string;
  manuscript: {
    id: string;
  };
  color?: string;
}

/**
 * Interface for manuscript label update input
 */
export interface ManuscriptLabelUpdateInput {
  title?: string;
  color?: string;
}

/**
 * Interface for API response from manuscript labels listing endpoint
 */
export interface ManuscriptLabelsResponse {
  success: boolean;
  entities: ManuscriptLabelRef[];
}

/**
 * Interface for manuscript stat reference
 * Based on manuscript-stat.yml specification
 */
export interface ManuscriptStatRef extends ManuscriptSubResourceBase {
  version_id: string;
  value?: number;
}

/**
 * Interface for manuscript stat response
 */
export interface ManuscriptStatResponse extends ManuscriptStatRef {
  created_at?: string;
  updated_at?: string;
}

/**
 * Interface for manuscript stat input
 */
export interface ManuscriptStatInput {
  title: string;
  version: {
    id: string;
  };
  value?: number;
}

/**
 * Interface for manuscript stat update input
 */
export interface ManuscriptStatUpdateInput {
  title?: string;
  value?: number;
}

/**
 * Interface for API response from manuscript stats listing endpoint
 */
export interface ManuscriptStatsResponse {
  success: boolean;
  entities: ManuscriptStatRef[];
}

/**
 * Interface for request options for pagination
 */
export interface ManuscriptSubResourceListOptions {
  offset?: number;
  limit?: number;
}
