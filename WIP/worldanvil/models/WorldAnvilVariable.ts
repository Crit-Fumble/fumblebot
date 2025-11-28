/**
 * World Anvil Variable Model
 * Represents variables and variable collections in the World Anvil system
 */

export interface WorldAnvilVariable {
  id: string;
  name: string;
  value: string;
  is_private: boolean;
  variable_collection_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorldAnvilVariableResponse {
  id: string;
  name: string;
  value: string;
  is_private: boolean;
  variable_collection_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorldAnvilVariableCollection {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  world_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorldAnvilVariableCollectionResponse {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  world_id: string;
  created_at?: string;
  updated_at?: string;
}
