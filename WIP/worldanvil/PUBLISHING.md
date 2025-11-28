# Publishing @crit-fumble/worldanvil to npm

This guide covers the process of publishing the @crit-fumble/worldanvil package to the npm registry.

## Prerequisites

1. Ensure you have an npm account:
   ```
   npm login
   ```

2. If this is an organization package, make sure you're a member of the organization:
   ```
   npm org ls @crit-fumble
   ```

## Before Publishing

1. Make sure all tests pass:
   ```
   npm test
   ```

2. Ensure the package builds correctly:
   ```
   npm run build
   ```

3. Check for lint errors:
   ```
   npm run lint
   ```

4. Review the package contents that will be published:
   ```
   npm pack --dry-run
   ```

## Publishing Process

### Option 1: Using the Convenience Scripts

For patch updates (bug fixes):
```
npm run publish-patch
```

For minor updates (non-breaking features):
```
npm run publish-minor
```

For major updates (breaking changes):
```
npm run publish-major
```

These scripts will automatically:
1. Run tests and lint checks
2. Bump the version number
3. Build the package
4. Publish to npm

### Option 2: Manual Publishing

1. Update the version number:
   ```
   npm version patch|minor|major
   ```

2. Build the package:
   ```
   npm run prepare
   ```

3. Publish to npm:
   ```
   npm publish
   ```

## After Publishing

1. Push the version changes to the repository:
   ```
   git push && git push --tags
   ```

2. Update dependent packages to use the new version:
   ```
   npm update @crit-fumble/worldanvil
   ```

## Using the Published Package

In other projects, install the package:
```
npm install @crit-fumble/worldanvil
```

For development, you can use the local version:
```
npm install --workspace=@crit-fumble/worldanvil
```
