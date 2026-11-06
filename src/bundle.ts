import { initFirstPartyWrapper, uninstallFirstPartyWrapper } from './index.js';
import './custom-element.js';

export { initFirstPartyWrapper, uninstallFirstPartyWrapper };

// Auto-initialize with zero configuration when loaded directly in browser via <script>
if (typeof window !== 'undefined') {
  initFirstPartyWrapper();
}
