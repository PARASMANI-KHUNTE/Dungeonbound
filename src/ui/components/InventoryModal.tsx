import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getItemDefinition } from '@/game/content/definitions/items';
import { EquipmentSlot, InventorySlot } from '@/game/domain/items/ItemTypes';
import { GameRuntime } from '@/game/engine/GameRuntime';
import { UiProjection } from '@/game/application/GameProjection';

export interface InventoryModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly runtime: GameRuntime;
  readonly uiState: UiProjection;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#8E9AAF',
  uncommon: '#52B788',
  rare: '#48CAE4',
  epic: '#B5179E',
  legendary: '#F77F00',
};

export const InventoryModal: React.FC<InventoryModalProps> = ({
  visible,
  onClose,
  runtime,
  uiState,
}) => {
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (!visible) return null;

  const {
    playerLevel,
    playerExperience,
    playerXpToNextLevel,
    derivedStats,
    inventory,
    equipment,
    playerHealth,
  } = uiState;

  const selectedSlot: InventorySlot | undefined =
    selectedSlotIndex !== null ? inventory[selectedSlotIndex] : undefined;
  const selectedItemDef = selectedSlot?.item
    ? getItemDefinition(selectedSlot.item.itemId)
    : undefined;

  const handleUseItem = (slotIndex: number) => {
    const res = runtime.useItem(slotIndex);
    if (!res.success) {
      setActionFeedback(res.reason ?? 'Failed to use item');
    } else {
      setActionFeedback(null);
    }
  };

  const handleEquipItem = (slotIndex: number) => {
    const res = runtime.equipItem(slotIndex);
    if (!res.success) {
      setActionFeedback(res.error ?? 'Failed to equip item');
    } else {
      setActionFeedback(null);
    }
  };

  const handleUnequipItem = (slot: EquipmentSlot) => {
    const res = runtime.unequipItem(slot);
    if (!res.success) {
      setActionFeedback(res.error ?? 'Failed to unequip item');
    } else {
      setActionFeedback(null);
    }
  };

  const renderEquipmentRow = (slotName: EquipmentSlot, label: string) => {
    const item = equipment[slotName];
    const def = item ? getItemDefinition(item.itemId) : undefined;
    const rarityColor = def ? RARITY_COLORS[def.rarity] ?? '#8E9AAF' : '#555';

    return (
      <View style={styles.equipmentRow} key={slotName}>
        <View style={styles.equipmentInfo}>
          <Text style={styles.equipmentSlotLabel}>{label}</Text>
          <Text style={[styles.equipmentItemName, { color: rarityColor }]}>
            {def ? def.name : '[ Empty ]'}
          </Text>
        </View>
        {item && (
          <TouchableOpacity
            style={styles.unequipButton}
            onPress={() => handleUnequipItem(slotName)}
          >
            <Text style={styles.unequipButtonText}>Unequip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const xpRatio = Math.max(0, Math.min(1, playerExperience / (playerXpToNextLevel || 1)));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Character & Inventory</Text>
              <Text style={styles.headerSubtitle}>Manage your gear, potions, and attributes</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <View style={styles.body}>
            {/* Left Column: Character Stats & Equipped Gear */}
            <View style={styles.leftColumn}>
              <Text style={styles.sectionHeader}>Hero Attributes</Text>
              <View style={styles.statsCard}>
                <View style={styles.statLine}>
                  <Text style={styles.statLabel}>Level:</Text>
                  <Text style={styles.statValueHighlight}>Lvl {playerLevel}</Text>
                </View>

                {/* XP Bar */}
                <View style={styles.xpBarContainer}>
                  <View style={[styles.xpBarFill, { width: `${xpRatio * 100}%` }]} />
                  <Text style={styles.xpText}>
                    {playerExperience} / {playerXpToNextLevel} XP
                  </Text>
                </View>

                <View style={styles.statLine}>
                  <Text style={styles.statLabel}>Health:</Text>
                  <Text style={styles.statValue}>
                    {playerHealth} / {derivedStats.maxHealth}
                  </Text>
                </View>
                <View style={styles.statLine}>
                  <Text style={styles.statLabel}>Attack Power:</Text>
                  <Text style={styles.statValue}>{derivedStats.attack}</Text>
                </View>
                <View style={styles.statLine}>
                  <Text style={styles.statLabel}>Defense:</Text>
                  <Text style={styles.statValue}>{derivedStats.defense}</Text>
                </View>
                <View style={styles.statLine}>
                  <Text style={styles.statLabel}>Movement Speed:</Text>
                  <Text style={styles.statValue}>{derivedStats.moveSpeed}</Text>
                </View>
                <View style={styles.statLine}>
                  <Text style={styles.statLabel}>Critical Chance:</Text>
                  <Text style={styles.statValue}>
                    {(derivedStats.criticalChance * 100).toFixed(0)}%
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionHeader}>Equipped Gear</Text>
              <View style={styles.equipmentList}>
                {renderEquipmentRow('weapon', 'Weapon')}
                {renderEquipmentRow('head', 'Head')}
                {renderEquipmentRow('body', 'Armor')}
                {renderEquipmentRow('accessory', 'Accessory')}
              </View>
            </View>

            {/* Right Column: Inventory Grid & Item Detail */}
            <View style={styles.rightColumn}>
              <Text style={styles.sectionHeader}>Inventory ({inventory.filter((s) => s.item !== null).length}/20)</Text>

              {/* Grid */}
              <View style={styles.grid}>
                {inventory.map((slot) => {
                  const isSelected = selectedSlotIndex === slot.slotIndex;
                  const item = slot.item;
                  const def = item ? getItemDefinition(item.itemId) : undefined;
                  const rarityColor = def ? RARITY_COLORS[def.rarity] ?? '#8E9AAF' : '#2B2D42';

                  return (
                    <TouchableOpacity
                      key={slot.slotIndex}
                      style={[
                        styles.gridSlot,
                        { borderColor: isSelected ? '#E5A93C' : rarityColor },
                        isSelected && styles.gridSlotSelected,
                      ]}
                      onPress={() => {
                        setSelectedSlotIndex(slot.slotIndex);
                        setActionFeedback(null);
                      }}
                    >
                      {item && (
                        <View style={styles.slotItemContent}>
                          <Text style={[styles.slotItemSymbol, { color: rarityColor }]}>
                            {def?.type === 'weapon'
                              ? '⚔'
                              : def?.type === 'armor'
                              ? '🛡'
                              : def?.type === 'accessory'
                              ? '💍'
                              : '🧪'}
                          </Text>
                          {item.quantity > 1 && (
                            <View style={styles.quantityBadge}>
                              <Text style={styles.quantityText}>{item.quantity}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action feedback error banner */}
              {actionFeedback && (
                <View style={styles.feedbackBanner}>
                  <Text style={styles.feedbackText}>{actionFeedback}</Text>
                </View>
              )}

              {/* Selected Item Detail Pane */}
              <View style={styles.detailPane}>
                {selectedSlot?.item && selectedItemDef ? (
                  <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.detailHeaderRow}>
                      <Text
                        style={[
                          styles.detailTitle,
                          { color: RARITY_COLORS[selectedItemDef.rarity] ?? '#FAF0CA' },
                        ]}
                      >
                        {selectedItemDef.name}
                      </Text>
                      <Text style={styles.detailRarity}>
                        {selectedItemDef.rarity.toUpperCase()} {selectedItemDef.type.toUpperCase()}
                      </Text>
                    </View>

                    <Text style={styles.detailDescription}>
                      {selectedItemDef.description}
                    </Text>

                    {/* Stat modifiers display */}
                    {selectedItemDef.statModifiers && (
                      <View style={styles.modifiersBox}>
                        {selectedItemDef.statModifiers.attack !== undefined && (
                          <Text style={styles.modText}>
                            +{selectedItemDef.statModifiers.attack} Attack
                          </Text>
                        )}
                        {selectedItemDef.statModifiers.defense !== undefined && (
                          <Text style={styles.modText}>
                            +{selectedItemDef.statModifiers.defense} Defense
                          </Text>
                        )}
                        {selectedItemDef.statModifiers.maxHealth !== undefined && (
                          <Text style={styles.modText}>
                            +{selectedItemDef.statModifiers.maxHealth} Max HP
                          </Text>
                        )}
                        {selectedItemDef.statModifiers.moveSpeed !== undefined && (
                          <Text style={styles.modText}>
                            +{selectedItemDef.statModifiers.moveSpeed} Movement Speed
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionRow}>
                      {selectedItemDef.type === 'consumable' && (
                        <TouchableOpacity
                          style={styles.actionButtonUse}
                          onPress={() => handleUseItem(selectedSlot.slotIndex)}
                        >
                          <Text style={styles.actionButtonText}>Use Potion</Text>
                        </TouchableOpacity>
                      )}

                      {selectedItemDef.slot && (
                        <TouchableOpacity
                          style={styles.actionButtonEquip}
                          onPress={() => handleEquipItem(selectedSlot.slotIndex)}
                        >
                          <Text style={styles.actionButtonText}>Equip to {selectedItemDef.slot}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScrollView>
                ) : (
                  <View style={styles.emptyDetailContainer}>
                    <Text style={styles.emptyDetailText}>
                      Select an item from the inventory grid to view its properties and actions.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '94%',
    maxHeight: '94%',
    backgroundColor: '#12141F',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3D405B',
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2B2D42',
    paddingBottom: 8,
    marginBottom: 10,
  },
  headerTitle: {
    color: '#FAF0CA',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#8E9AAF',
    fontSize: 11,
  },
  closeButton: {
    backgroundColor: '#2B2D42',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FAF0CA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  body: {
    flexDirection: 'row',
    gap: 14,
  },
  leftColumn: {
    flex: 1.1,
  },
  rightColumn: {
    flex: 1.4,
  },
  sectionHeader: {
    color: '#E5A93C',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  statsCard: {
    backgroundColor: '#1A1C2B',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#2B2D42',
    marginBottom: 8,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  statLabel: {
    color: '#8E9AAF',
    fontSize: 11,
  },
  statValue: {
    color: '#FAF0CA',
    fontSize: 11,
    fontWeight: '600',
  },
  statValueHighlight: {
    color: '#E5A93C',
    fontSize: 11,
    fontWeight: 'bold',
  },
  xpBarContainer: {
    height: 14,
    backgroundColor: '#0F1019',
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#2B2D42',
  },
  xpBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#48CAE4',
  },
  xpText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  equipmentList: {
    backgroundColor: '#1A1C2B',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#2B2D42',
  },
  equipmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#232538',
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentSlotLabel: {
    color: '#8E9AAF',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  equipmentItemName: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  unequipButton: {
    backgroundColor: '#2B2D42',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unequipButtonText: {
    color: '#FAF0CA',
    fontSize: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  gridSlot: {
    width: 36,
    height: 36,
    backgroundColor: '#1A1C2B',
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gridSlotSelected: {
    backgroundColor: '#26283D',
    borderWidth: 2,
  },
  slotItemContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotItemSymbol: {
    fontSize: 16,
  },
  quantityBadge: {
    position: 'absolute',
    bottom: 1,
    right: 2,
    backgroundColor: '#0F1019',
    borderRadius: 6,
    paddingHorizontal: 2,
  },
  quantityText: {
    color: '#FAF0CA',
    fontSize: 8,
    fontWeight: 'bold',
  },
  feedbackBanner: {
    backgroundColor: '#E63946',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detailPane: {
    backgroundColor: '#1A1C2B',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#2B2D42',
    height: 105,
  },
  detailScroll: {
    flex: 1,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailRarity: {
    color: '#8E9AAF',
    fontSize: 9,
    fontWeight: '600',
  },
  detailDescription: {
    color: '#CCD2E3',
    fontSize: 10,
    marginBottom: 4,
  },
  modifiersBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  modText: {
    color: '#52B788',
    fontSize: 10,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonUse: {
    backgroundColor: '#2A9D8F',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actionButtonEquip: {
    backgroundColor: '#E76F51',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyDetailContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDetailText: {
    color: '#6C757D',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
