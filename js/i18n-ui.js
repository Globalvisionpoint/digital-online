/* ============================================================
   Interface strings for the parts of the site that JavaScript
   builds at runtime (the cookie banner and the contact form
   message).

   The page tells this file which language it is in through
   <html lang="...">; the strings below are matched against that
   value, with Romanian as the fallback.
   ============================================================ */

(function () {
  'use strict';

  var STRINGS = {
    ro: {
      'cookie.title': 'Preferințe cookie',
      'cookie.body': 'Reținem alegerea ta în stocarea locală necesară. În prezent, site-ul nu încarcă instrumente opționale de analiză sau publicitate. Poți consulta <a href="politica-cookie.html">politica de cookies</a>.',
      'cookie.reject': 'Respinge opționale',
      'cookie.settings': 'Setări',
      'cookie.accept': 'Acceptă toate',
      'cookie.dialog.eyebrow': 'CONTROLUL PREFERINȚELOR',
      'cookie.dialog.title': 'Setări cookie',
      'cookie.dialog.close': 'Închide setările',
      'cookie.dialog.description': 'Poți schimba alegerea oricând din linkul „Setări cookie” din subsol. Preferința se păstrează 180 de zile.',
      'cookie.necessary.title': 'Strict necesare',
      'cookie.necessary.body': 'Necesare pentru reținerea preferinței tale; sunt mereu active.',
      'cookie.necessary.aria': 'Cookie-uri strict necesare, mereu active',
      'cookie.analytics.title': 'Analiză',
      'cookie.analytics.note': 'Nu este activă în prezent pe acest site.',
      'cookie.marketing.title': 'Marketing',
      'cookie.marketing.note': 'Nu este activ în prezent pe acest site.',
      'cookie.close': 'Închide',
      'cookie.save': 'Salvează preferințele',
      'cookie.note': 'Salvarea unei preferințe nu activează instrumente care nu sunt instalate pe site.',
      'footer.legal.label': 'Informații legale',
      'footer.privacy': 'Confidențialitate',
      'footer.cookies': 'Politica de cookies',
      'footer.terms': 'Termeni și condiții',
      'footer.cookieSettings': 'Setări cookie',
      'form.notConnected': 'Formularul online nu este conectat și mesajul nu a fost trimis. Scrie-ne la contact@digital-online.ro sau contactează-ne pe WhatsApp.'
    },

    en: {
      'cookie.title': 'Cookie preferences',
      'cookie.body': 'We store your choice in the local storage needed to remember it. At present the site loads no optional analytics or advertising tools. You can read our <a href="politica-cookie.html">cookie policy</a>.',
      'cookie.reject': 'Reject optional',
      'cookie.settings': 'Settings',
      'cookie.accept': 'Accept all',
      'cookie.dialog.eyebrow': 'PREFERENCE CONTROLS',
      'cookie.dialog.title': 'Cookie settings',
      'cookie.dialog.close': 'Close the settings',
      'cookie.dialog.description': 'You can change your choice at any time from the "Cookie settings" link in the footer. Your preference is kept for 180 days.',
      'cookie.necessary.title': 'Strictly necessary',
      'cookie.necessary.body': 'Needed to remember your preference; always active.',
      'cookie.necessary.aria': 'Strictly necessary cookies, always active',
      'cookie.analytics.title': 'Analytics',
      'cookie.analytics.note': 'Not active on this site at present.',
      'cookie.marketing.title': 'Marketing',
      'cookie.marketing.note': 'Not active on this site at present.',
      'cookie.close': 'Close',
      'cookie.save': 'Save preferences',
      'cookie.note': 'Saving a preference does not activate tools that are not installed on the site.',
      'footer.legal.label': 'Legal information',
      'footer.privacy': 'Privacy',
      'footer.cookies': 'Cookie policy',
      'footer.terms': 'Terms and conditions',
      'footer.cookieSettings': 'Cookie settings',
      'form.notConnected': 'This form is not connected and your message was not sent. Write to us at contact@digital-online.ro or message us on WhatsApp.'
    },

    es: {
      'cookie.title': 'Preferencias de cookies',
      'cookie.body': 'Guardamos tu elección en el almacenamiento local necesario. Actualmente el sitio no carga herramientas opcionales de analítica ni publicidad. Puedes consultar nuestra <a href="politica-cookie.html">política de cookies</a>.',
      'cookie.reject': 'Rechazar opcionales',
      'cookie.settings': 'Ajustes',
      'cookie.accept': 'Aceptar todo',
      'cookie.dialog.eyebrow': 'CONTROL DE PREFERENCIAS',
      'cookie.dialog.title': 'Ajustes de cookies',
      'cookie.dialog.close': 'Cerrar los ajustes',
      'cookie.dialog.description': 'Puedes cambiar tu elección en cualquier momento desde el enlace «Ajustes de cookies» del pie de página. Tu preferencia se conserva 180 días.',
      'cookie.necessary.title': 'Estrictamente necesarias',
      'cookie.necessary.body': 'Necesarias para recordar tu preferencia; siempre están activas.',
      'cookie.necessary.aria': 'Cookies estrictamente necesarias, siempre activas',
      'cookie.analytics.title': 'Analítica',
      'cookie.analytics.note': 'No está activa actualmente en este sitio.',
      'cookie.marketing.title': 'Marketing',
      'cookie.marketing.note': 'No está activo actualmente en este sitio.',
      'cookie.close': 'Cerrar',
      'cookie.save': 'Guardar preferencias',
      'cookie.note': 'Guardar una preferencia no activa herramientas que no estén instaladas en el sitio.',
      'footer.legal.label': 'Información legal',
      'footer.privacy': 'Privacidad',
      'footer.cookies': 'Política de cookies',
      'footer.terms': 'Términos y condiciones',
      'footer.cookieSettings': 'Ajustes de cookies',
      'form.notConnected': 'Este formulario no está conectado y el mensaje no se ha enviado. Escríbenos a contact@digital-online.ro o contáctanos por WhatsApp.'
    },

    'pt-BR': {
      'cookie.title': 'Preferências de cookies',
      'cookie.body': 'Guardamos a sua escolha no armazenamento local necessário. No momento o site não carrega ferramentas opcionais de análise ou publicidade. Você pode consultar a nossa <a href="politica-cookie.html">política de cookies</a>.',
      'cookie.reject': 'Recusar opcionais',
      'cookie.settings': 'Configurações',
      'cookie.accept': 'Aceitar todos',
      'cookie.dialog.eyebrow': 'CONTROLE DE PREFERÊNCIAS',
      'cookie.dialog.title': 'Configurações de cookies',
      'cookie.dialog.close': 'Fechar as configurações',
      'cookie.dialog.description': 'Você pode mudar sua escolha quando quiser, pelo link "Configurações de cookies" no rodapé. A preferência é guardada por 180 dias.',
      'cookie.necessary.title': 'Estritamente necessários',
      'cookie.necessary.body': 'Necessários para lembrar a sua preferência; sempre ativos.',
      'cookie.necessary.aria': 'Cookies estritamente necessários, sempre ativos',
      'cookie.analytics.title': 'Análise',
      'cookie.analytics.note': 'Não está ativo neste site no momento.',
      'cookie.marketing.title': 'Marketing',
      'cookie.marketing.note': 'Não está ativo neste site no momento.',
      'cookie.close': 'Fechar',
      'cookie.save': 'Salvar preferências',
      'cookie.note': 'Salvar uma preferência não ativa ferramentas que não estejam instaladas no site.',
      'footer.legal.label': 'Informações legais',
      'footer.privacy': 'Privacidade',
      'footer.cookies': 'Política de cookies',
      'footer.terms': 'Termos e condições',
      'footer.cookieSettings': 'Configurações de cookies',
      'form.notConnected': 'Este formulário não está conectado e a mensagem não foi enviada. Escreva para contact@digital-online.ro ou fale conosco pelo WhatsApp.'
    }
  };

  var html = document.documentElement;
  var lang = html.getAttribute('lang') || 'ro';

  /* The locale keys are written as they appear in the HTML tag
     ('pt-BR'), but the comparison has to ignore case, so the tables
     are indexed by their lower-cased name as well. */
  var table = STRINGS[lang];
  if (!table) {
    var wanted = lang.toLowerCase();
    for (var key in STRINGS) {
      if (Object.prototype.hasOwnProperty.call(STRINGS, key) && key.toLowerCase() === wanted) {
        table = STRINGS[key];
        break;
      }
    }
  }
  if (!table) table = STRINGS.ro;

  /* Expose the resolved strings so the other scripts can use them. */
  window.digitalOnlineI18n = table;

  /** Look up a string, falling back to Romanian and then the key. */
  window.t = function (key) {
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    if (Object.prototype.hasOwnProperty.call(STRINGS.ro, key)) return STRINGS.ro[key];
    return key;
  };

  /** The current locale code, e.g. 'pt-BR'. */
  window.digitalOnlineLocale = lang;
})();
