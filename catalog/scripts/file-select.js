const FILE_ICONS = Object.freeze({
  css: '<path d="M4 3h16l-1.5 17L12 22l-6.5-2L4 3Z"></path><path d="M16 7H8.5l.4 4H16l-.5 5-3.5 1-3.5-1-.2-2"></path>',
  html: '<path d="m9 4-4 8 4 8"></path><path d="m15 4 4 8-4 8"></path>',
  javascript: '<path d="M10 8v6a2 2 0 0 1-4 0"></path><path d="M18 10a2 2 0 0 0-2-2h-1a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-1a2 2 0 0 1-2-2"></path>',
  json: '<path d="M8 3a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2"></path><path d="M16 3a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2"></path>',
  markdown: '<path d="M4 6v12"></path><path d="m4 6 4 5 4-5v12"></path><path d="M17 6v8"></path><path d="m14 12 3 3 3-3"></path>',
  svg: '<circle cx="12" cy="12" r="9"></circle><path d="M12 3v18"></path><path d="M3 12h18"></path>',
  text: '<path d="M14 3v5h5"></path><path d="M15 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"></path>',
});

function iconMarkup(language) {
  const paths = FILE_ICONS[language] ?? FILE_ICONS.text;
  return `<svg class="ui-icon file-select__icon" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

let fileSelectId = 0;

/**
 * A listbox built from buttons rather than a native select. The native control cannot
 * carry an icon per option and its popup is painted by the operating system, so it can
 * never match the catalog surface.
 */
export function createFileSelect(container, { labelId, onSelect }) {
  fileSelectId += 1;
  const triggerId = 'source-file-select';
  const listboxId = `file-select-listbox-${fileSelectId}`;

  container.innerHTML = `
    <button
      class="file-select__trigger"
      id="${triggerId}"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded="false"
      aria-controls="${listboxId}"
      ${labelId ? `aria-labelledby="${labelId} ${triggerId}"` : ''}
    ></button>
    <div
      class="file-select__listbox"
      id="${listboxId}"
      role="listbox"
      ${labelId ? `aria-labelledby="${labelId}"` : ''}
      hidden
    ></div>
  `;

  const trigger = container.querySelector('.file-select__trigger');
  const listbox = container.querySelector('.file-select__listbox');

  let items = [];
  let selectedValue = null;
  let activeValue = null;
  let open = false;

  function renderTrigger() {
    const item = items.find((candidate) => candidate.value === selectedValue);

    trigger.innerHTML = item
      ? `${iconMarkup(item.language)}<span class="file-select__value">${escapeHtml(item.label)}</span>
         <svg class="ui-icon file-select__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>`
      : `<span class="file-select__value" data-empty="true">No files</span>`;

    trigger.dataset.value = item?.value ?? '';
    trigger.disabled = items.length === 0;
  }

  function renderListbox() {
    listbox.innerHTML = items
      .map(
        (item) => `
          <button
            class="file-select__option${item.value === activeValue ? ' is-active' : ''}${
              item.value === selectedValue ? ' is-selected' : ''
            }"
            type="button"
            role="option"
            data-value="${escapeHtml(item.value)}"
            aria-selected="${String(item.value === selectedValue)}"
          >
            ${iconMarkup(item.language)}
            <span class="file-select__value">${escapeHtml(item.label)}</span>
            ${
              item.value === selectedValue
                ? '<svg class="ui-icon file-select__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>'
                : ''
            }
          </button>
        `,
      )
      .join('');

    const active = listbox.querySelector('.file-select__option.is-active');
    if (active) {
      trigger.setAttribute('aria-activedescendant', '');
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  function setOpen(next) {
    open = next;
    listbox.hidden = !next;
    trigger.setAttribute('aria-expanded', String(next));

    if (next) {
      activeValue = selectedValue ?? items[0]?.value ?? null;
      renderListbox();
    }
  }

  function commit(value) {
    selectedValue = value;
    renderTrigger();
    setOpen(false);
    trigger.focus();
    onSelect?.(value);
  }

  function moveActive(step) {
    if (!items.length) {
      return;
    }

    const currentIndex = items.findIndex((item) => item.value === activeValue);
    const base = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex =
      step === 'first'
        ? 0
        : step === 'last'
          ? items.length - 1
          : Math.min(items.length - 1, Math.max(0, base + step));

    activeValue = items[nextIndex].value;
    renderListbox();
  }

  trigger.addEventListener('click', () => setOpen(!open));

  trigger.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(
        { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }[event.key],
      );
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (open && activeValue !== null) {
        event.preventDefault();
        commit(activeValue);
      }
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  });

  listbox.addEventListener('click', (event) => {
    const option = event.target.closest('[data-value]');
    if (option) {
      commit(option.dataset.value);
    }
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (open && !container.contains(event.target)) {
        setOpen(false);
      }
    },
    true,
  );

  return {
    setItems(nextItems, nextValue = nextItems[0]?.value ?? null) {
      items = nextItems;
      selectedValue = nextValue;
      activeValue = nextValue;
      renderTrigger();
      renderListbox();
    },
    setValue(value) {
      selectedValue = value;
      renderTrigger();
      renderListbox();
    },
    get value() {
      return selectedValue;
    },
  };
}
