// These texts can be customized by each DRep
const DREP_NAME = process.env.NEXT_PUBLIC_DREP_NAME;

export const TITLE_TEXT = `Verify as ${DREP_NAME} Delegator`;

export const INSTRUCTION_TEXT = `Connect your Cardano wallet to verify that you are delegating to ${DREP_NAME}. Once verified, you can participate in governance discussions and provide feedback on proposals.`;

export const DELEGATE_TEXT = `Delegate to ${DREP_NAME}`;

export const CONNECT_TEXT = "Verify & Connect to Discord";

export const CONTINUE_TEXT = "Continue in Discord";

export enum ERROR_TEXT {
  API = "An error occurred while verifying your delegation. Please refresh & try again.",
  WALLET_CONNECT = "An error occurred connecting wallet. Your wallet is either not connected, not supported, or not on mainnet. Please try again.",
  WALLET_SIGN = "An error occurred while processing your delegation. Please refresh & try again.",
  REDIRECT = "An error occurred while redirecting you to Discord. Please try again or proceed to Discord manually.",
  NOT_DELEGATED = "Your wallet is not delegating to this DRep. Please delegate first before verifying.",
}

export enum SUCCESS_TEXT {
  API = 'You are now verified! Please click "Continue in Discord" to participate in governance feedback.',
}
