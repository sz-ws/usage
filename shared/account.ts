/**
 * The billing day is the one thing only the owner can say about an account: a
 * token that reads analytics alone cannot see the subscription. Until it is
 * given there is no billing period to hold usage against.
 */
export function isConfigured(account: { renewalDay: number | null }): account is { renewalDay: number } {
  return account.renewalDay !== null;
}
