{
  description = "Open Design — local-first design product. Daemon (`od` CLI) + Next.js static web frontend.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    # Security backport package set used only for Node; the application package
    # set and every existing flake input remain on their current locks.
    node-runtime-nixpkgs = {
      url = "github:NixOS/nixpkgs/7d8eff2d34e4143dd91b5753f410031d306e20a9";
      flake = false;
    };
    flake-utils.url = "github:numtide/flake-utils";
    dream2nix = {
      url = "github:nix-community/dream2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    node-runtime-nixpkgs,
    flake-utils,
    dream2nix,
    home-manager,
  }: let
    filterProjectSource = includePaths:
      nixpkgs.lib.cleanSourceWith {
        src = self;
        filter = path: type: let
          root = toString self;
          pathStr = toString path;
          rel = nixpkgs.lib.removePrefix (root + "/") pathStr;
          matches = includePath:
            rel == includePath
            || nixpkgs.lib.hasPrefix (includePath + "/") rel
            || (type == "directory" && nixpkgs.lib.hasPrefix (rel + "/") includePath);
        in
          rel == ""
          || builtins.any matches includePaths;
      };

    perSystem = flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {inherit system;};
      nodeRuntimePkgs = import node-runtime-nixpkgs {
        inherit system;
        overlays = [
          (final: prev: {
            simdjson = let
              candidate = prev.callPackage ./nix/simdjson-security.nix {};
            in
              assert prev.lib.versions.major candidate.version == "4";
              assert prev.lib.versionAtLeast candidate.version "4.6.11";
              candidate;
            # Ada transitively links simdutf 9; patch that compatible API line.
            # Node 24's separate simdutf 6 dependency must remain unchanged.
            ada = let
              simdutfForAda = prev.callPackage ./nix/simdutf-security.nix {};
            in
              assert prev.lib.versions.major simdutfForAda.version == "9";
              assert prev.lib.versionAtLeast simdutfForAda.version "9.2.1";
              prev.ada.override {
                simdutf = simdutfForAda;
                simdjson = final.simdjson;
              };
          })
        ];
      };
      # Use the separately qualified runtime closure. A Node version label in
      # another package set does not prove its shared libraries are patched.
      nodejs =
        assert pkgs.lib.versions.major nodeRuntimePkgs.nodejs_24.version == "24";
        assert pkgs.lib.versionAtLeast nodeRuntimePkgs.nodejs_24.version "24.22.1";
        assert pkgs.lib.versionAtLeast nodeRuntimePkgs.c-ares.version "1.34.9";
        assert pkgs.lib.versionAtLeast nodeRuntimePkgs.brotli.version "1.2.1";
        nodeRuntimePkgs.nodejs_24;
      workspacePackageManifests = workspacePaths:
        map (workspacePath: "${workspacePath}/package.json") workspacePaths;
      # Keep in sync with .github/workflows/ci.yml change_scopes
      # nix_validation_required filter.
      daemonWorkspacePaths = [
        "packages/release"
        "packages/contracts"
        "packages/registry-protocol"
        "packages/agui-adapter"
        "packages/plugin-runtime"
        "packages/sidecar-proto"
        "packages/sidecar"
        "packages/platform"
        "packages/diagnostics"
        "apps/daemon"
      ];
      # Keep in sync with .github/workflows/ci.yml change_scopes
      # nix_validation_required filter.
      webWorkspacePaths = [
        "packages/release"
        "packages/components"
        "packages/contracts"
        "packages/host"
        "packages/platform"
        "packages/sidecar"
        "packages/sidecar-proto"
        "apps/web"
      ];
      daemonSrc = filterProjectSource ([
        "package.json"
        "pnpm-lock.yaml"
        "pnpm-workspace.yaml"
        "tsconfig.json"
        "assets"
        "plugins"
        "skills"
        "design-systems"
        "design-templates"
        "craft"
        "prompt-templates"
      ]
      ++ daemonWorkspacePaths);
      webSrc = filterProjectSource ([
        "package.json"
        "pnpm-lock.yaml"
        "pnpm-workspace.yaml"
        "tsconfig.json"
      ]
      ++ webWorkspacePaths);
      pnpmDepsBaseInputs = [
        "package.json"
        "pnpm-lock.yaml"
        "pnpm-workspace.yaml"
      ];
      daemonPnpmDepsSrc = filterProjectSource (
        pnpmDepsBaseInputs ++ workspacePackageManifests daemonWorkspacePaths
      );
      webPnpmDepsSrc = filterProjectSource (
        pnpmDepsBaseInputs ++ workspacePackageManifests webWorkspacePaths
      );

      # nixpkgs ships pnpm 10.33.0; the repo's package.json declares
      # `engines.pnpm: ">=10.33.2 <11"` and pnpm refuses to install
      # against an older binary. Override the upstream tarball to
      # the exact version pinned by `packageManager`. Bump the url
      # + hash in lockstep with package.json#packageManager.
      #
      # When bumping versions, run the following to get a new hash:
      #
      # ```bash
      # nix store prefetch-file --hash-type sha256 \
      #   https://registry.npmjs.org/pnpm/-/pnpm-${NEW_VERSION}.tgz
      # ```
      pnpm_10 = (pkgs.pnpm_10.override {inherit nodejs;}).overrideAttrs (_old: rec {
        version = "10.33.2";
        src = pkgs.fetchurl {
          url = "https://registry.npmjs.org/pnpm/-/pnpm-${version}.tgz";
          hash = "sha256-envPE9f2zrOUbAOXg3PZm+n94cr8MAC9/tTE95EWdhA=";
        };
      });

      daemon = pkgs.callPackage ./nix/package-daemon.nix {
        inherit dream2nix nixpkgs system nodejs pnpm_10;
        src = daemonSrc;
        pnpmDepsSrc = daemonPnpmDepsSrc;
        workspacePaths = daemonWorkspacePaths;
      };
      web = pkgs.callPackage ./nix/package-web.nix {
        inherit dream2nix nixpkgs system nodejs pnpm_10;
        src = webSrc;
        pnpmDepsSrc = webPnpmDepsSrc;
        workspacePaths = webWorkspacePaths;
      };
    in {
      packages = {
        inherit daemon web;
        default = daemon;
      };

      # Wrap `od` with `--no-open` for `nix run`: the daemon package
      # builds the daemon workspace only, not `apps/web/out/`, so the
      # browser would otherwise auto-open onto an empty static dir.
      #
      # Set OD_DATA_DIR to a writable location when unset. The Nix store
      # is read-only at runtime, so the daemon cannot write to its default
      # `<projectRoot>/.od` location under `nix run`.
      apps.default = {
        type = "app";
        program = "${pkgs.writeShellScript "od-nix-run" ''
          export OD_DATA_DIR="''${OD_DATA_DIR:-$HOME/.od}"
          exec ${daemon}/bin/od --no-open "$@"
        ''}";
        meta.description = "Open Design local daemon (`od`)";
      };

      devShells.default = pkgs.mkShell {
        packages = [
          nodejs
          pnpm_10
        ];
        shellHook = ''
          echo "🎨 Open Design dev shell loaded!"
          echo ""
          echo "Language runtimes:"
          echo "  - 🐢 Node.js: $(node --version 2>/dev/null || echo 'not found')"
          echo "  - 📦 pnpm:    $(pnpm --version 2>/dev/null || echo 'not found')"
          echo ""
          echo "Quick start:"
          echo "  - 🚀 pnpm install"
          echo "  - 🚀 pnpm tools-dev    # local lifecycle entry point"
          echo ""
        '';
      };

      checks = {
        daemon = daemon;
        web = web;
      };

      formatter = pkgs.nixpkgs-fmt;
    });

    moduleCommon = import ./nix/module-common.nix;
  in
    perSystem
    // {
      homeManagerModules = rec {
        open-design = import ./nix/home-manager.nix {
          inherit moduleCommon;
          flake = self;
        };
        default = open-design;
      };

      nixosModules = rec {
        open-design = import ./nix/nixos.nix {
          inherit moduleCommon;
          flake = self;
        };
        default = open-design;
      };
    };
}
