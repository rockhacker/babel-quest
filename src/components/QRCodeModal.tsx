import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  token?: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, url, token }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && url) {
      generateQRCode();
    }
  }, [isOpen, url]);

  const generateQRCode = async () => {
    setLoading(true);
    try {
      const qrCodeUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      setQrCodeDataUrl(qrCodeUrl);
    } catch (error) {
      console.error('生成二维码失败:', error);
      toast({
        title: "生成失败",
        description: "无法生成二维码",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "复制成功",
        description: "URL已复制到剪贴板",
      });
    } catch (error) {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      });
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `qrcode-${token || Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "下载成功",
      description: "二维码图片已保存",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>二维码显示</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 二维码显示区域 */}
          <div className="flex justify-center">
            {loading ? (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">生成中...</p>
                </div>
              </div>
            ) : qrCodeDataUrl ? (
              <div className="p-4 bg-white rounded-lg shadow-sm border">
                <img 
                  src={qrCodeDataUrl} 
                  alt="QR Code" 
                  className="w-64 h-64 mx-auto"
                />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">无法生成二维码</p>
              </div>
            )}
          </div>

          {/* URL 信息 */}
          <div className="space-y-2">
            {token && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Token:</label>
                <p className="font-mono text-sm bg-muted p-2 rounded">
                  {token}
                </p>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-muted-foreground">URL:</label>
              <p className="text-sm bg-muted p-2 rounded break-all">
                {url}
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={copyUrl}
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              复制URL
            </Button>
            
            <Button
              variant="outline"
              onClick={downloadQRCode}
              disabled={!qrCodeDataUrl}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              下载二维码
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeModal;