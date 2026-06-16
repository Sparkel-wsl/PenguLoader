import { onMount } from 'solid-js';
import { toast } from './Toaster';
import { _t } from '../lib/i18n';
import { fetchUpdate } from '../lib/updater';

async function doCheckUpdate() {
  const update = await fetchUpdate();
  if (update === false) return;

  toast.custom((t) => {
    return (
      <div class={`${!t.visible && 'hidden'} relative w-[370px] bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden`}>
        <div class="p-2">
          <div class="flex items-start">
            <div class="flex-shrink-0 pt-[2px] text-gray-600">
              <svg width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <path d="M9 12h-3.586a1 1 0 0 1 -.707 -1.707l6.586 -6.586a1 1 0 0 1 1.414 0l6.586 6.586a1 1 0 0 1 -.707 1.707h-3.586v3h-6v-3z"></path>
                <path d="M9 21h6"></path>
                <path d="M9 18h6"></path>
              </svg>
            </div>
            <div class="ml-3 w-0 flex-1 pt-0.5">
              <p class="text-sm font-bold text-sky-500">{_t('update_available')} - {update.version}</p>
              <p class="mt-1 text-sm text-gray-700">{_t('update_hint')}</p>
            </div>
            <div class="ml-4 flex-shrink-0 flex">
              <button
                class="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500"
                onClick={() => toast.dismiss(t.id)}
              >
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }, { duration: 30000, position: 'bottom-left' });
}

export function Welcome() {
  onMount(() => {
    /*toast.success(_t('active_status'), {
      position: 'bottom-left',
      duration: 7000
    });*/
  });

  onMount(doCheckUpdate);

  return <></>;
}