import {ComponentOptions, Prop as PropOptions, WatchOptions, ComponentPublicInstance} from 'vue';
type Constructor<T> = Function & { prototype: T }
interface Vue extends ComponentPublicInstance {}
declare class Vue implements ComponentPublicInstance {}

type Hooks = 'beforeCreate' | 'created' | 'beforeMount' | 'mounted' | 'beforeUpdate' | 'updated' | 'activated' | 'deactivated' | 'beforeUnmount' | 'unmounted' | 'errorCaptured' | 'renderTracked' | 'renderTriggered';

export declare function Component<V extends Constructor<Vue>>(target: V): V;
export declare function Component(options: ComponentOptions): <V extends Constructor<Vue>>(target: V) => V;

declare const Prop: PropertyDecorator & ((options: PropOptions<any>) => PropertyDecorator);

export declare function Watch(expression: string, options?: WatchOptions): MethodDecorator;

export declare function Hook(name: Hooks): MethodDecorator;

export {Prop}
export default Vue;

