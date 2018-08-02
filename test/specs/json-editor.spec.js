import Vuex from 'vuex';
import { expect } from 'chai';
import { createLocalVue, mount } from '@vue/test-utils';

import store from '../../src/store';
import EventHub from '../../src/modules/event-hub';
import JsonEditor from '../../src/components/json/json-editor/json-editor.vue';
import JsonEvents from '../../src/components/json/events/json-events';
import SharedState from '../../src/modules/shared-state';
import Styles from '../../src/styles';
import TestHelpers from './test-helpers';

const localVue = createLocalVue();
localVue.use(Vuex);
localVue.component(
  'font-awesome-icon',
  Styles.components['font-awesesome-icon'],
);
localVue.use(Vuex);

describe('JsonEditor', () => {
  let jsonEditorWrapper;

  const mountSubjectUnderTest = ({
    destroyAfter,
    id,
    objectData,
    wrapperCreator,
  }) => {
    ['json', 'json__container'].forEach(className => (document.body
    .classList.add(className)));

    const jsonEditorComponentWrapper = wrapperCreator.apply(
      null,
      [JsonEditor, objectData],
    );
    jsonEditorComponentWrapper.vm.$refs['json-editor']
    .$refs['editable-json'].classList.add('json');
    jsonEditorComponentWrapper.vm.$refs['json-editor']
    .$refs['dynamic-json'].classList.add('json');

    if (typeof destroyAfter === 'undefined' || destroyAfter) {
      jsonEditorWrapper = jsonEditorComponentWrapper;
    }

    if (typeof destroyAfter !== 'undefined' && !destroyAfter) {
      jsonEditorWrapper = undefined;
    }

    if (typeof id !== 'undefined') {
      jsonEditorComponentWrapper.vm.$el.setAttribute('id', id);
    }

    return jsonEditorComponentWrapper;
  };

  const isVisible = function (element) {
    return window.getComputedStyle(element).display !== 'none';
  };

  afterEach(() => {
    TestHelpers.destroyComponent(jsonEditorWrapper);
  });

  it('should mount a JSON editor with two distinct sections', () => {
    const json = '{}';
    SharedState.state.json = json;

    const subjectUnderTestWrapper = mountSubjectUnderTest({
      objectData: {
        attachToDocument: true,
        store,
      },
      wrapperCreator: mount,
    });

    const template = '<json-object></json-object>';
    subjectUnderTestWrapper.vm.setJsonTemplate(template);

    return localVue.nextTick().then(() => {
      expect(subjectUnderTestWrapper.contains('.json-editor')).to.be.true;
      expect(subjectUnderTestWrapper.contains('.editable-json.editable-json--ready'))
      .to.be.true;
      expect(subjectUnderTestWrapper.contains('.dynamic-json')).to.be.true;
      expect(subjectUnderTestWrapper.vm.json).to.equal(json);
      expect(SharedState.state.template).to.equal(template);
      const text = subjectUnderTestWrapper.text();
      expect(text).to.equal('{  }{  }');
    });
  });

  it('should allow to toggle the visibility of pairs in objects', (done) => {
    localVue.config.errorHandler = done;

    let subjectUnderTestWrapper;

    const template = '<json-object has-children>'
      + ' <json-pair>'
      + '   <template slot="key">"Key"</template>'
      + '   <template slot="colon">:</template>'
      + '   <template slot="value"><json-value>"Value"</json-value></template>'
      + ' </json-pair>'
      + '</json-object>';

    let togglePairVisibilityButton;

    const ensurePairVisibilityToggling = ({ hook, component }) => {
      localVue.nextTick().then(() => {
        let dynamicPairComponent;

        if (hook === JsonEvents.node.afterBeingHidden) {
          // Ensure pair is hidden after its visibility has been toggled
          const pair = subjectUnderTestWrapper.vm
          .$refs['json-editor']
          .$refs['dynamic-json']
          .querySelector('.json__pair');
          expect(isVisible(pair)).to.be.false;

          const uuid = pair.getAttribute('data-uuid');

          // A dynamic component (oppositely to an editable component)
          // reflects operations applied to its editable counterpart.
          dynamicPairComponent = subjectUnderTestWrapper.vm.getComponentByUuid(uuid);
          expect(dynamicPairComponent.isVisible).to.be.false;
          expect(dynamicPairComponent.isEditable).to.be.false;

          // The editor tracks editable elements, dynamic elements
          // and their corrrespondance
          const editablePairComponent = subjectUnderTestWrapper.vm
          .getEditableCounterpartFor(dynamicPairComponent.uuid);

          // The editable pair component has been marked as not being visible anymore,
          // event though we can "see" it in the "editable-json" panel
          expect(editablePairComponent.isVisible).to.be.false;
          expect(editablePairComponent.isEditable).to.be.true;

          togglePairVisibilityButton.click();
          return;
        }

        dynamicPairComponent = component;
        expect(dynamicPairComponent.isVisible).to.be.true;
        expect(dynamicPairComponent.isEditable).to.be.false;

        const editablePairComponent = subjectUnderTestWrapper.vm
        .getEditableCounterpartFor(dynamicPairComponent.uuid);
        expect(editablePairComponent.isVisible).to.be.true;
        expect(editablePairComponent.isEditable).to.be.true;

        EventHub.$off(
          JsonEvents.node.altered,
          ensurePairVisibilityToggling,
        );
        done();
      });
    };

    EventHub.$on(
      JsonEvents.node.altered,
      ensurePairVisibilityToggling,
    );

    subjectUnderTestWrapper = mountSubjectUnderTest({
      objectData: {
        attachToDocument: true,
        store,
        localVue,
      },
      wrapperCreator: mount,
    });

    subjectUnderTestWrapper.vm.setJsonTemplate(template);
    const text = subjectUnderTestWrapper.text().replace(/\s/g, '');
    expect(text).to.equal('{"Key":"Value",}{"Key":"Value",}');

    togglePairVisibilityButton = document.querySelector('.editable-json .json__pair---button');
    expect(isVisible(
      subjectUnderTestWrapper.vm
      .$refs['json-editor']
      .$refs['dynamic-json']
      .querySelector('.json__object'),
    )).to.be.true;

    togglePairVisibilityButton.click();
  }).timeout(4000);

  it('should allow to add a pair after an existing one', (done) => {
    localVue.config.errorHandler = done;

    const registeredComponents = [];
    const afterRegistration = ({ component }) => {
      registeredComponents.push(component);
      if (registeredComponents.length === 8) {
        EventHub.$off(
          JsonEvents.node.afterRegistration,
          afterRegistration,
        );
        const buttons = document.querySelectorAll('.editable-json .json__pair---button');
        const addPairAfterButton = buttons[1];
        addPairAfterButton.click();
      }
    };

    const afterPairAddition = ({
      editableComponentAddition,
      dynamicComponentAddition,
      editableComponent,
      dynamicComponent,
    }) => {
      localVue.nextTick(() => {
        expect(document.querySelectorAll('.editable-json .json__pair')
        .length).to.equal(2);
        expect(document.querySelectorAll('.dynamic-json .json__pair')
        .length).to.equal(2);

        expect(editableComponentAddition.isClonable).to.be.true;
        expect(editableComponentAddition.isEditable).to.be.true;
        expect(dynamicComponentAddition.isClonable).to.be.false;
        expect(dynamicComponentAddition.isEditable).to.be.false;

        expect(editableComponent.isClonable).to.be.true;
        expect(editableComponent.isEditable).to.be.true;
        expect(dynamicComponent.isClonable).to.be.false;
        expect(dynamicComponent.isEditable).to.be.false;

        EventHub.$off(
          JsonEvents.node.afterPairAddition,
          afterPairAddition,
        );
        done();
      });
    };

    EventHub.$on(
      JsonEvents.node.afterPairAddition,
      afterPairAddition,
    );

    EventHub.$on(
      JsonEvents.node.afterRegistration,
      afterRegistration,
    );

    const subjectUnderTestWrapper = mountSubjectUnderTest({
      objectData: {
        attachToDocument: true,
        store,
        localVue,
      },
      wrapperCreator: mount,
    });

    const template = '<json-object has-children>'
      + ' <json-pair>'
      + '   <template slot="key">"Key"</template>'
      + '   <template slot="colon">:</template>'
      + '   <template slot="value"><json-value>"Value"</json-value></template>'
      + ' </json-pair>'
      + '</json-object>';
    subjectUnderTestWrapper.vm.setJsonTemplate(template);
  });

  it('should allow to edit a key or a value', (done) => {
    localVue.config.errorHandler = done;

    const registeredComponents = [];
    let pairValue;
    const clickOnPairValue = ({ component }) => {
      registeredComponents.push(component);
      if (registeredComponents.length === 8) {
        const editableValues = document.querySelectorAll('.editable-json .json__value');
        pairValue = editableValues[1];
        pairValue.click();
      }
    };

    let subjectUnderTestWrapper;
    let editions = 0;

    const afterBeingMadeEditable = ({ component }) => {
      localVue.nextTick(() => {
        editions += 1;
        EventHub.$off(JsonEvents.node.afterRegistration, clickOnPairValue);

        expect(component.isEdited).to.be.true;

        expect(component.$el.getAttribute('contenteditable'))
        .to.be.equal('true');

        let newValue;
        if (editions === 1) {
          newValue = '"value updated"';
        }

        if (editions === 2) {
          newValue = '"value updated again"';
        }

        component.$el.innerText = newValue;

        // Click outside of the edited component
        subjectUnderTestWrapper.vm.$refs['json-editor']
        .$refs['dynamic-json'].click();

        expect(component.$el.hasAttribute('contenteditable'))
        .to.be.false;

        const editableCompanent = component;
        expect(editableCompanent.isEdited).to.be.false;
        expect(editableCompanent.getTextFromSlot()).to.equal(newValue);
        expect(editableCompanent.text).to.equal(newValue);

        const dynamicComponent = subjectUnderTestWrapper.vm
        .getDynamicCounterpartFor(component.uuid);
        expect(dynamicComponent.getTextFromSlot()).to.equal(newValue);
        expect(dynamicComponent.text).to.equal(newValue);

        if (editions === 2) {
          EventHub.$off(
            JsonEvents.node.afterBeingMadeEditable,
            afterBeingMadeEditable,
          );
          done();

          return;
        }

        pairValue.click();
      });
    };

    EventHub.$on(
      JsonEvents.node.afterBeingMadeEditable,
      afterBeingMadeEditable,
    );

    EventHub.$on(
      JsonEvents.node.afterRegistration,
      clickOnPairValue,
    );

    subjectUnderTestWrapper = mountSubjectUnderTest({
      objectData: {
        attachToDocument: true,
        store,
        localVue,
      },
      wrapperCreator: mount,
    });

    const template = '<json-object has-children>'
      + ' <json-pair>'
      + '   <template slot="key">"Key"</template>'
      + '   <template slot="colon">:</template>'
      + '   <template slot="value"><json-value>"Value"</json-value></template>'
      + ' </json-pair>'
      + '</json-object>';
    subjectUnderTestWrapper.vm.setJsonTemplate(template);
  });
});
