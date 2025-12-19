import { Injectable } from '@nestjs/common';

export interface TransactionImageData {
  txType: string;
  status: string;
  chainName: string;
  safeAddress: string;
  confirmationsSubmitted?: number;
  confirmationsRequired?: number;
}

@Injectable()
export class ShareImageGenerator {
  private readonly width = 1200;
  private readonly height = 630;
  private readonly backgroundColor = '#121312';
  private readonly primaryColor = '#12FF80';
  private readonly textColor = '#FFFFFF';
  private readonly mutedColor = '#A1A3A7';
  private readonly pendingColor = '#FFB800';

  async generateTransactionImage(data: TransactionImageData): Promise<Buffer> {
    const svg = this.generateSvg(data);
    return Buffer.from(svg, 'utf-8');
  }

  getSvgContentType(): string {
    return 'image/svg+xml';
  }

  private generateSvg(data: TransactionImageData): string {
    const statusColors: Record<string, string> = {
      Executed: this.primaryColor,
      Pending: this.pendingColor,
      Failed: '#FF5F72',
      Cancelled: this.mutedColor,
    };

    const statusColor = statusColors[data.status] || this.mutedColor;
    const truncatedAddress = this.truncateAddress(data.safeAddress);
    const isPending = data.status === 'Pending';
    const hasSignatureInfo =
      data.confirmationsSubmitted !== undefined &&
      data.confirmationsRequired !== undefined;

    const signaturesSection =
      isPending && hasSignatureInfo
        ? this.generateSignaturesSection(
            data.confirmationsSubmitted!,
            data.confirmationsRequired!,
          )
        : '';

    return `<svg width="${this.width}" height="${this.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="90%" cy="15%" r="30%">
      <stop offset="0%" stop-color="${this.primaryColor}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${this.primaryColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="${this.backgroundColor}"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  
  <!-- Branding -->
  <text x="80" y="100" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="bold" fill="${this.primaryColor}">Safe</text>
  <text x="80" y="140" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="${this.mutedColor}">Smart Account</text>
  
  <!-- Transaction Type -->
  <text x="80" y="300" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="bold" fill="${this.textColor}">${this.escapeXml(data.txType)}</text>
  
  <!-- Status Badge -->
  <rect x="80" y="340" rx="8" ry="8" width="${data.status.length * 18 + 40}" height="50" fill="${statusColor}" fill-opacity="0.2"/>
  <text x="100" y="375" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="bold" fill="${statusColor}">${this.escapeXml(data.status.toUpperCase())}</text>
  
  ${signaturesSection}
  
  <!-- Chain Info -->
  <text x="80" y="480" font-family="system-ui, -apple-system, sans-serif" font-size="32" fill="${this.mutedColor}">on ${this.escapeXml(data.chainName)}</text>
  
  <!-- Safe Address -->
  <text x="80" y="540" font-family="monospace" font-size="28" fill="${this.mutedColor}">${this.escapeXml(truncatedAddress)}</text>
</svg>`;
  }

  private generateSignaturesSection(
    submitted: number,
    required: number,
  ): string {
    const remaining = required - submitted;
    const progressWidth = 200;
    const progressHeight = 12;
    const progressX = 350;
    const progressY = 352;
    const filledWidth = (submitted / required) * progressWidth;

    return `
  <!-- Signatures Progress -->
  <text x="${progressX}" y="375" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="${this.textColor}">${submitted}/${required} signed</text>
  
  <!-- Progress Bar Background -->
  <rect x="${progressX + 180}" y="${progressY}" rx="6" ry="6" width="${progressWidth}" height="${progressHeight}" fill="${this.mutedColor}" fill-opacity="0.3"/>
  
  <!-- Progress Bar Fill -->
  <rect x="${progressX + 180}" y="${progressY}" rx="6" ry="6" width="${filledWidth}" height="${progressHeight}" fill="${this.pendingColor}"/>
  
  <!-- Remaining Text -->
  <text x="${progressX + 400}" y="375" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="${this.mutedColor}">${remaining} more needed</text>`;
  }

  private truncateAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.slice(0, 10)}...${address.slice(-8)}`;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
