import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { memo } from 'react';
import { StyleProp, TextStyle } from 'react-native';

export type IconName =
  | 'bolt'
  | 'house'
  | 'notifications'
  | 'arrow_back'
  | 'document_scanner'
  | 'receipt_long'
  | 'insights'
  | 'auto_awesome'
  | 'bar_chart'
  | 'person'
  | 'calendar_today'
  | 'calendar_month'
  | 'event'
  | 'arrow_forward'
  | 'arrow_downward'
  | 'more_vert'
  | 'flashlight_on'
  | 'flashlight_off'
  | 'photo_camera'
  | 'photo_library'
  | 'picture_as_pdf'
  | 'lock'
  | 'chevron_right'
  | 'thumb_up'
  | 'thumb_down'
  | 'content_copy'
  | 'mic'
  | 'graphic_eq'
  | 'arrow_upward'
  | 'download'
  | 'refresh'
  | 'close'
  | 'check'
  | 'verified'
  | 'home'
  | 'sparkles'
  | 'speed'
  | 'eco'
  | 'water_drop'
  | 'local_fire_department'
  | 'mode_fan'
  | 'kitchen'
  | 'tv'
  | 'payments'
  | 'trending_down'
  | 'electric_meter'
  | 'tune'
  | 'help_outline'
  | 'dark_mode'
  | 'light_mode'
  | 'schedule'
  | 'trending_up'
  | 'delete_sweep'
  | 'wifi'
  | 'info'
  | 'error'
  | 'visibility'
  | 'visibility_off'
  | 'palette'
  | 'logout';

const iconMap: Record<IconName, keyof typeof MaterialIcons.glyphMap> = {
  logout: 'logout',
  visibility: 'visibility',
  visibility_off: 'visibility-off',
  error: 'error-outline',
  info: 'info-outline',
  bolt: 'bolt',
  house: 'house',
  notifications: 'notifications-none',
  arrow_back: 'arrow-back',
  document_scanner: 'document-scanner',
  receipt_long: 'receipt-long',
  insights: 'insights',
  auto_awesome: 'auto-awesome',
  bar_chart: 'bar-chart',
  person: 'person-outline',
  calendar_today: 'calendar-today',
  calendar_month: 'calendar-month',
  event: 'event',
  arrow_forward: 'arrow-forward',
  arrow_downward: 'arrow-downward',
  more_vert: 'more-vert',
  flashlight_on: 'flashlight-on',
  flashlight_off: 'flashlight-off',
  photo_camera: 'photo-camera',
  photo_library: 'photo-library',
  picture_as_pdf: 'picture-as-pdf',
  lock: 'lock-outline',
  chevron_right: 'chevron-right',
  thumb_up: 'thumb-up-off-alt',
  thumb_down: 'thumb-down-off-alt',
  content_copy: 'content-copy',
  mic: 'mic',
  graphic_eq: 'graphic-eq',
  arrow_upward: 'arrow-upward',
  download: 'file-download',
  refresh: 'refresh',
  close: 'close',
  check: 'check',
  verified: 'verified',
  home: 'home',
  sparkles: 'auto-awesome',
  speed: 'speed',
  eco: 'eco',
  water_drop: 'water-drop',
  local_fire_department: 'local-fire-department',
  mode_fan: 'air',
  kitchen: 'kitchen',
  tv: 'tv',
  payments: 'payments',
  trending_down: 'trending-down',
  electric_meter: 'electric-meter',
  tune: 'tune',
  help_outline: 'help-outline',
  dark_mode: 'dark-mode',
  light_mode: 'light-mode',
  schedule: 'schedule',
  trending_up: 'trending-up',
  delete_sweep: 'delete-sweep',
  wifi: 'wifi',
  palette: 'palette',
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

function IconBase({ name, size = 20, color = '#102B55', style }: IconProps) {
  const glyph = iconMap[name] || 'help-outline';
  return <MaterialIcons name={glyph} size={size} color={color} style={style} />;
}

export const Icon = memo(IconBase);
