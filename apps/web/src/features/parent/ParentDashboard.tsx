import { useState } from 'react';
import { Panel, FeedItem, Button } from '@/components/ui/Primitives';
import { children, storeItems } from '@/data/mockData';
import { MpesaModal, type ModalStage } from './MpesaModal';

export function ParentDashboard() {
  const [activeChildId, setActiveChildId] = useState(children[0].id);
  const [modalStage, setModalStage] = useState<ModalStage>('closed');
  const activeChild = children.find((c) => c.id === activeChildId)!;

  function handleSend(_phone: string) {
    setModalStage('sending');
    // In the real app this calls POST /payments/mpesa/stk-push and then
    // polls or listens for the callback-driven status update.
    setTimeout(() => setModalStage('success'), 1800);
  }

  function closeModal() {
    setModalStage('closed');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Family Overview</div>
          <div className="page-sub">MRS. KIMANI'S ACCOUNT</div>
        </div>
      </div>

      <div className="child-tabs">
        {children.map((c) => (
          <div
            key={c.id}
            className={`child-tab ${c.id === activeChildId ? 'active' : ''}`}
            onClick={() => setActiveChildId(c.id)}
          >
            {c.name} (age {c.age})
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Panel title="Subscription — August">
          <div className="sub-status">
            <div className="sub-status-left">
              <div className="amt">{activeChild.subscriptionAmount}</div>
              <div className="due">
                DUE {activeChild.dueDate.toUpperCase()} · {activeChild.daysRemaining} DAYS REMAINING
              </div>
            </div>
            <Button onClick={() => setModalStage('form')}>Pay with M-Pesa</Button>
          </div>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title={`${activeChild.name}'s Progress`}>
          {activeChild.progressNotes.map((n) => (
            <FeedItem key={n.id} text={n.text} />
          ))}
        </Panel>
        <Panel title="Upcoming">
          {activeChild.upcoming.map((u) => (
            <FeedItem key={u.id} text={u.text} />
          ))}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Club Store" linkLabel="Browse all">
          <div className="store-grid">
            {storeItems.map((item) => (
              <div className="store-item" key={item.id}>
                <div className="store-thumb" />
                <div className="store-body">
                  <div className="store-name">{item.name}</div>
                  <div className="store-price">{item.price}</div>
                  <Button variant="ghost" size="sm">
                    <span style={{ display: 'block', width: '100%' }}>Add to cart</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <MpesaModal
        stage={modalStage}
        childName={activeChild.name}
        amount={activeChild.subscriptionAmount}
        onClose={closeModal}
        onSend={handleSend}
      />
    </>
  );
}
