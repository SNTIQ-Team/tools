// Registers this module's strings with the shared i18n setup (see
// registerModuleResources in core/i18n). Imported by every file that uses
// the 'chamfer' namespace, so the strings load with the module's own code.
import { registerModuleResources } from '@/core/i18n';
import { chamferResources } from '.';

registerModuleResources(chamferResources);
