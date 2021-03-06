<template>
  <fragment-transition v-if='isArrayItem'>
    <transition 
      name="custom-classes-transition" 
      mode='in-out'
      enter-active-class="animated fadeInLeftBig" 
      leave-active-class="animated hinge"
    >
      <span 
        class='json__value--array-item'
        v-show='isShown'
        :ref='uuid'
        :data-uuid='uuid'
        :data-editable='isEditable'
      >
        <span :class='classes'><slot></slot></span>
      </span>
    </transition>
    <button
      class='json__value--button'
      v-if='hasText'
      v-on:click='toggleVisibility'>
      <font-awesome-icon
        class='json__value--button-icon'
        :icon='getIconName' />
    </button>
  </fragment-transition>
  <span
    v-else
    :class='classes'
    v-click-outside="makeContentNonEditable"
    @click='makeContentEditable'
    @keyup.esc='makeContentNonEditable'
    @keyup.exact.enter='makeContentNonEditable'
    @key='makeContentNonEditable'
    :data-edited='isEdited'
    :data-uuid='uuid'
    :ref='uuid'
  ><slot></slot></span>
</template>

<script>
import ClickOutside from 'vue-click-outside';

import Comma from '../comma.vue';
import FragmentTransition from '../fragment-transition.vue';
import EventHub from '../../../modules/event-hub';
import SharedState from '../../../modules/shared-state';
import MutationTypes from '../json-editor/json-editor-mutation-types';
import Editable from '../editable';
import WithEditableContent from '../with-editable-content';
import JsonEvents from '../events/json-events';

import { createNamespacedHelpers } from 'vuex';
const { mapActions, mapMutations } = createNamespacedHelpers('json-editor');

export default {
  name: 'json-value',
  components: {
    Comma,
    FragmentTransition,
  },
  directives: {
    ClickOutside
  },
  mixins: [
    Editable.Editable,
    WithEditableContent,
  ],
  props: {
    textAtFirst: {
      type: String,
      default: '' 
    },
    isKey: {
      type: Boolean,
      default: false,
    },
    isArrayItem: {
      type: Boolean,
      default: false,
    },
  },
  created: function () {
    this.$nextTick(function () {
      if (!this.isRegistered 
      && (!this.isArrayItem || this.hasText)
      && typeof this.$slots.default !== 'undefined'
      && typeof this.$slots.default[0] !== 'undefined'
      && typeof this.$slots.default[0].text !== 'undefined') {
        this.text = this.$slots.default[0].text;
      }

      this.register('created');
    })
  },
  mounted: function () {
    this.$nextTick(function () {
      if (!this.hasText) { 
        return;
      }
      
      if (this.isArrayItem) {
        return;
      }

      if (typeof this.$slots.default === 'undefined') {
        this.$slots.default = [this.text];
        return;
      }

      const acceptedSlots = this.$slots.default.filter(
        (VNode) => {
          return typeof VNode === 'undefined'
          || typeof VNode.tag === 'undefined'
        }
      );
      this.$slots.default = acceptedSlots; 
      this.$forceUpdate();

      let slotsText = '';
      const text = this.$slots.default.reduce(
        (text, VNode) => {
          if (typeof VNode === 'undefined') {
            return text;
          }

          if (typeof VNode === 'string') {
            return `${text}${VNode}`;
          }

          return `${text}${VNode.text}`;
        },
        slotsText
      );

      this.$slots.default = this.$slots.default.slice(0, 1);
      this.$slots.default[0] = this.text;
      this.text = text;
    });
  },
  updated: function () {
    this.$nextTick(function () {
      if (!this.hasText
      || !this.isVisible
      || this.isEditable) { 
        return;
      }

      return;
      
      if (typeof this.$slots.default === 'undefined') {
        this.$slots.default = [];
      }

      const text = this.getTextFromSlot();

      this.$slots.default[0] = text;
      this.$el.innerText = text;
      this.$el.innerHtml = text;
    });
  },
  beforeDestroy: function () {
    EventHub.$emit(
      JsonEvents.node.destroyed,
      { component: this, uuidAttribute: this.uuid, hook: 'beforeDestroy' }
    );
  },
  methods: {
    ...mapMutations([
      MutationTypes.SET_PREVIOUS_VALUE,
      MutationTypes.SET_NEXT_VALUE,
    ]),
    getTextFromSlot: function () {
      if (typeof this.sharedState.values[this.uuid] !== 'undefined') {
        return this.sharedState.values[this.uuid];
      }

      if (typeof this.$slots.default === 'undefined') {
        if (!this.isArrayItem && typeof this.$el !== 'undefined') {
          return this.$el.innerText;
        }

        return '';
      }

      if (this.$slots.default.length > 0) {
        const textSlots = this.$slots.default.filter((VNode) => {
          return typeof VNode !== 'undefined'
          && (typeof VNode == 'string' || typeof VNode.tag === 'undefined');
        });
        let textSnippets = textSlots.map((VNode) => {
          if (typeof VNode === 'string') {
            return VNode;
          }
          return VNode.text;
        });

        return textSnippets.join('');
      }

      return this.$slots.default[0];
    }
  },
  data: function () {
    return {
      isLastChild: false,
      nodeType: this.getNodeTypes().value,
      sharedState: SharedState.state,
      value: null,
    }
  },
  computed: {
    text: {
      get: function () {
        return this.value;
      },
      set: function (text) {
        if (this.isArrayItem) {
          return;
        }

        if (typeof this.$slots.default === 'undefined') {
          this.$slots.default = [];
        }

        this.value = text;
        this.$slots.default[0] = this.value;
        this.sharedState.values[this.uuid] = this.value;
      }
    },
    hasText: function () {
      if (typeof this.getTextFromSlot() === 'undefined') {
        return false;
      }

      const text = this.getTextFromSlot();

      return text.trim().length > 0;
    },
    hasNoText: function () {
      return !this.hasText;
    },
    classes: function () {
      const classes = {
        'json__value': true,
        'json__value--editable': true,
        'json__value--key': false,
        'json__value--boolean': false,
        'json__value--null': false,
        'json__value--has-text': this.hasText,
      };

      if (this.isKey) {
        classes['json__value--key'] = true;
        return classes;
      }

      if (this.text === 'false'
      || this.text === 'true') {
        classes['json__value--boolean'] = true;
      }

      if (this.text === 'null') {
        classes['json__value--null'] = true;
      }

      return classes;
    },
  },
};
</script>

<style lang="scss" scoped>
@import './json-value.scss';
</style>