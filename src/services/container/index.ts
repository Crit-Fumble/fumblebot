/**
 * Container Service
 *
 * Manages container lifecycle and Core API integration.
 */

export {
  ContainerClient,
  getContainerClient,
  configureContainerClient,
  type ContainerClientConfig,
  type UserContext,
} from './client.js';

export { setupContainerProxy, type ContainerProxyConfig } from './proxy.js';
