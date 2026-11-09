(function () {
  'use strict';

  const copy = {
    ro: {
      title: 'Pagina nu a fost găsită | Digital Online',
      eyebrow: 'Eroare 404',
      heading: 'Pagina nu a fost găsită.',
      description: 'Linkul poate fi vechi sau pagina a fost mutată. Te ajutăm să găsești drumul înapoi.',
      home: 'Înapoi la pagina principală',
      contact: 'Vorbește cu echipa',
      languages: 'Alege limba'
    },
    en: {
      title: 'Page not found | Digital Online',
      eyebrow: 'Error 404',
      heading: 'We couldn’t find that page.',
      description: 'The link may be outdated, or the page may have moved. Let’s help you find your way back.',
      home: 'Back to the homepage',
      contact: 'Talk to our team',
      languages: 'Choose a language'
    },
    es: {
      title: 'Página no encontrada | Digital Online',
      eyebrow: 'Error 404',
      heading: 'No encontramos esta página.',
      description: 'Puede que el enlace esté desactualizado o que la página se haya movido. Te ayudamos a volver.',
      home: 'Volver al inicio',
      contact: 'Habla con nuestro equipo',
      languages: 'Elige un idioma'
    },
    'pt-BR': {
      title: 'Página não encontrada | Digital Online',
      eyebrow: 'Erro 404',
      heading: 'Não encontramos esta página.',
      description: 'O link pode estar desatualizado ou a página pode ter mudado. Vamos ajudar você a voltar.',
      home: 'Voltar à página inicial',
      contact: 'Fale com a nossa equipe',
      languages: 'Escolha um idioma'
    }
  };

  const path = window.location.pathname.toLowerCase();
  const locale = path.startsWith('/pt-br/') ? 'pt-BR'
    : path.startsWith('/en/') ? 'en'
      : path.startsWith('/es/') ? 'es'
        : 'ro';
  const prefix = locale === 'pt-BR' ? '/pt-br' : locale === 'ro' ? '' : `/${locale}`;
  const strings = copy[locale];

  document.documentElement.lang = locale;
  document.title = strings.title;
  document.querySelectorAll('[data-404]').forEach(element => {
    const key = element.dataset['404'];
    if (key === 'eyebrow' || key === 'heading' || key === 'description' ||
        key === 'home' || key === 'contact' || key === 'languages-label') {
      element.textContent = key === 'languages-label' ? strings.languages : strings[key];
    }
  });
  document.querySelectorAll('[data-404-home]').forEach(link => {
    link.href = `${prefix}/`;
  });
  document.querySelector('[data-404-contact]').href = `${prefix}/#contact`;
  document.querySelector('.not-found-languages').setAttribute('aria-label', strings.languages);

  document.querySelectorAll('[data-locale]').forEach(link => {
    const targetLocale = link.dataset.locale;
    if (targetLocale === locale) {
      link.setAttribute('aria-current', 'page');
    }
    link.addEventListener('click', () => {
      document.cookie = `digital-online-lang=${encodeURIComponent(targetLocale)}; Path=/; Max-Age=15552000; SameSite=Lax`;
    });
  });
})();
