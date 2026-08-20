/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from 'vitest';
import { HARDENED_SECURITY_POLICY } from '../src/constants/securityPolicy';
import { DEFAULT_SETTINGS } from '../src/settings/defaultSettings';

describe('hardened security policy', () => {
    it('keeps optional network and parser attack surfaces disabled', () => {
        expect(HARDENED_SECURITY_POLICY).toEqual({
            allowExternalFeatureImages: false,
            allowExternalIconDownloads: false,
            allowPdfThumbnails: false,
            allowReleaseChecks: false,
            allowRemoteReleaseMedia: false
        });
    });

    it('defaults related user settings to the restrictive state', () => {
        expect(DEFAULT_SETTINGS.checkForUpdatesOnStart).toBe(false);
        expect(DEFAULT_SETTINGS.downloadExternalFeatureImages).toBe(false);
        expect(DEFAULT_SETTINGS.enablePropertyExternalLinks).toBe(false);
    });
});
