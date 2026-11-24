// Starter legal text. This is a TEMPLATE, not legal advice: have a qualified lawyer in your
// jurisdiction review and adapt it before taking real customers.
export interface LegalDoc { title: string; sections: { h: string; p: string[] }[] }

export function legalDocs(site: string, supportEmail: string): Record<string, LegalDoc> {
  return {
    privacy: {
      title: 'Privacy Policy',
      sections: [
        { h: 'What we collect', p: [
          'When you sign in with Google we receive your name and email address. You also choose your country, language and currency. For each order we store the package, price, currency, country and status.',
          `We never receive or store your Google password. We never ask for passwords, one-time codes or recovery codes for any service.`] },
        { h: 'Payment information', p: [
          `Payments are arranged directly with the administrator over WhatsApp. ${site} does not collect or store card or bank details on this website. Messages you send on WhatsApp are handled by WhatsApp under its own terms.`] },
        { h: 'How we use it', p: [
          'To create and manage your account and orders, to verify payments manually, to send transactional emails about your account and orders, and to give support. The administrator is notified by email of new registrations, orders, payment status changes and support requests.'] },
        { h: 'Service providers', p: [
          'We use Supabase (database and authentication), Google (sign-in), Resend (email) and Vercel (hosting). These providers process data on our behalf.'] },
        { h: 'Retention and your rights', p: [
          'We keep account and order records for as long as needed to run the service and meet legal obligations. You can ask to access, correct or delete your data by contacting us. Deleting data may be limited where we must keep order records.'] },
        { h: 'Consent', p: ['By signing in you consent to this processing. You can withdraw consent by closing your account through support.'] },
      ],
    },
    terms: {
      title: 'Terms of Service',
      sections: [
        { h: 'Who we are', p: [`${site} is an independent service. It is not affiliated with, endorsed by, or operated by any government authority or third-party platform.`] },
        { h: 'What credits are', p: [
          'Credits are redeemable only for the service described on the package you buy, which is shown on the package card, at checkout and on your order. Credits have no cash value and cannot be used for anything that is not described there.'] },
        { h: 'Orders and payment', p: [
          'Placing an order creates an order ID. An order is not paid until the administrator verifies your payment by hand. Opening WhatsApp or telling us you sent proof does not approve a payment. Only an administrator can approve or reject a payment.',
          'Prices shown in a currency other than the package currency may be estimates. The payable amount is confirmed with you before you pay. Your order price is fixed when you place the order.'] },
        { h: 'Your responsibilities', p: [
          'Provide accurate information. Do not share passwords, one-time codes or recovery codes with anyone. Do not use the service for unlawful purposes or to break the rules of any third-party service.'] },
        { h: 'Suspension', p: ['We may suspend accounts that breach these terms or that we reasonably suspect of fraud.'] },
        { h: 'Liability', p: ['To the extent permitted by law, our liability is limited to the amount you paid for the affected order.'] },
      ],
    },
    refund: {
      title: 'Refund Policy',
      sections: [
        { h: 'How to request a refund', p: ['Open your order and choose "Request a refund". You can do this once your payment has been approved.'] },
        { h: 'Before fulfilment', p: ['If your order has not been fulfilled, you are entitled to a refund of the amount paid, using the method agreed with the administrator.'] },
        { h: 'After fulfilment', p: ['Fulfilled orders are reviewed case by case. We will refund where the service was not delivered as described.'] },
        { h: 'Timing', p: ['Refund requests are reviewed manually. You will receive an email when the outcome is recorded.'] },
      ],
    },
    contact: {
      title: 'Contact',
      sections: [
        { h: 'Get in touch', p: [
          'The fastest way to reach us is WhatsApp: use the "Chat on WhatsApp" button on the home page or your account.',
          supportEmail ? `You can also email ${supportEmail}.` : 'You can also send a message from your account page.'] },
      ],
    },
  };
}
